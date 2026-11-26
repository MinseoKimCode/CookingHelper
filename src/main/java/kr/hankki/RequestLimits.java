package kr.hankki;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/** Single-process MVP limits. Forwarded headers are deliberately not trusted. */
@Component
class RequestLimits extends OncePerRequestFilter {

    private static final Set<String> AI = Set.of(
        "/api/recommend",
        "/api/recognize",
        "/api/video/recipe",
        "/api/video/analyze",
        "/api/explain",
        "/api/guide"
    );

    private record Bucket(long until, int count) {}

    private final Map<String, Bucket> buckets = new HashMap<>();
    private final int perIp;
    private final int total;
    private final int youtubePerIp;
    private final int youtubeTotal;
    private final int writePerMinute;

    RequestLimits(
        @Value("${AI_REQUESTS_PER_HOUR:12}") int perIp,
        @Value("${AI_TOTAL_REQUESTS_PER_DAY:100}") int total,
        @Value("${YOUTUBE_REQUESTS_PER_HOUR:20}") int youtubePerIp,
        @Value("${YOUTUBE_TOTAL_REQUESTS_PER_DAY:60}") int youtubeTotal,
        @Value("${WRITE_REQUESTS_PER_MINUTE:60}") int writePerMinute
    ) {
        if (
            perIp < 1 || total < 1 || youtubePerIp < 1 || youtubeTotal < 1 || writePerMinute < 1
        ) throw new IllegalArgumentException("AI limits must be positive");
        this.perIp = perIp;
        this.total = total;
        this.youtubePerIp = youtubePerIp;
        this.youtubeTotal = youtubeTotal;
        this.writePerMinute = writePerMinute;
    }

    private synchronized long limit(String key, int maximum, long duration) {
        long now = System.currentTimeMillis();
        buckets.entrySet().removeIf(e -> e.getValue().until() <= now);
        Bucket old = buckets.get(key);
        if (old != null && old.count() >= maximum) return Math.max(
            1,
            (old.until() - now + 999) / 1000
        );
        // Bound memory even if many different addresses reach the server.
        if (old == null && buckets.size() >= 20000) return 60;
        buckets.put(
            key,
            old == null ? new Bucket(now + duration, 1) : new Bucket(old.until(), old.count() + 1)
        );
        return 0;
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain chain
    ) throws ServletException, IOException {
        String path = request.getRequestURI();
        // API routes have no encoded/static path components or matrix parameters.
        // Reject ambiguous spellings before Spring decodes them into a paid route.
        if (
            path.contains("%") ||
            path.contains(";") ||
            path.contains("\\") ||
            path.contains("//") ||
            path.contains("/./") ||
            path.contains("/../")
        ) {
            response.setStatus(400);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"error\":\"잘못된 요청 경로예요.\"}");
            return;
        }
        boolean youtube = "GET".equals(request.getMethod()) && path.startsWith("/api/youtube/");
        if ((!"POST".equals(request.getMethod()) && !youtube) || !path.startsWith("/api/")) {
            chain.doFilter(request, response);
            return;
        }
        String ip = request.getRemoteAddr();
        long retry = youtube
            ? limit("youtube:" + ip, youtubePerIp, 3600000)
            : limit("write:" + ip, writePerMinute, 60000);
        if (retry == 0 && youtube) retry = limit("youtube:global", youtubeTotal, 86400000);
        else if (retry == 0 && AI.contains(path)) {
            retry = limit("ai:" + ip, perIp, 3600000);
            if (retry == 0) retry = limit("ai:global", total, 86400000);
        } else if (retry == 0 && path.matches("/api/recipes/[^/]+/view")) {
            retry = limit("view:" + ip + ":" + path, 1, 1800000);
        } else if (
            retry == 0 && path.matches("/api/recipes/[^/]+/reviews|/api/community/posts/[^/]+/like")
        ) {
            // Allow undo, edits and multiple viewers behind one router. Share the
            // quota across targets so changing recipe/post IDs cannot bypass it.
            String action = path.endsWith("/like") ? "like:" : "review:";
            retry = limit(action + ip, 10, 60000);
        }
        if (retry > 0) {
            response.setStatus(429);
            response.setHeader("Retry-After", Long.toString(retry));
            response.setContentType("application/json;charset=UTF-8");
            response
                .getWriter()
                .write("{\"error\":\"요청이 많아요. 잠시 후 다시 시도해 주세요.\"}");
            return;
        }
        chain.doFilter(request, response);
    }
}
