package kr.hankki;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

/**
 * YouTube Data API v3 (official, needs YOUTUBE_API_KEY). Search costs 100 quota units of the free 10,000 per day,
 * so every response is cached for six hours.
 */
@RestController
@RequestMapping("/api/youtube")
class YoutubeApi {

    private record Cached(long at, JsonNode value) {}

    private final Environment env;
    private final ObjectMapper json;
    private final HttpClient http = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(5))
        .build();
    private final Map<String, Cached> cache = new ConcurrentHashMap<>();
    private static final java.util.regex.Pattern RECIPE_HINT = java.util.regex.Pattern.compile(
        "재료|ingredient|\\d+\\s*(g|ml|큰술|작은술|스푼|컵|개)",
        java.util.regex.Pattern.CASE_INSENSITIVE
    );

    YoutubeApi(Environment env, ObjectMapper json) {
        this.env = env;
        this.json = json;
    }

    boolean enabled() {
        return !env.getProperty("YOUTUBE_API_KEY", "").isBlank();
    }

    private String base() {
        return env
            .getProperty("YOUTUBE_BASE_URL", "https://www.googleapis.com/youtube/v3")
            .replaceAll("/+$", "");
    }

    private JsonNode call(String path, Map<String, String> params) {
        if (!enabled()) throw new ResponseStatusException(
            HttpStatus.SERVICE_UNAVAILABLE,
            "서버에 YOUTUBE_API_KEY를 설정하면 유튜브 영상을 불러올 수 있어요."
        );
        var query = new StringBuilder();
        var all = new TreeMap<>(params);
        all.put("key", env.getProperty("YOUTUBE_API_KEY"));
        for (var e : all.entrySet())
            query
                .append(query.isEmpty() ? "?" : "&")
                .append(e.getKey())
                .append('=')
                .append(URLEncoder.encode(e.getValue(), StandardCharsets.UTF_8));
        String cacheKey = path + new TreeMap<>(params);
        var hit = cache.get(cacheKey);
        if (
            hit != null && System.currentTimeMillis() - hit.at() < 6 * 3600_000L
        ) return hit.value();
        try {
            var response = http.send(
                HttpRequest.newBuilder(URI.create(base() + "/" + path + query))
                    .timeout(Duration.ofSeconds(10))
                    .GET()
                    .build(),
                HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)
            );
            if (response.statusCode() == 403) throw new ResponseStatusException(
                HttpStatus.BAD_GATEWAY,
                "유튜브 API 사용 한도에 도달했거나 키 권한이 없어요. 키와 할당량을 확인해주세요."
            );
            if (response.statusCode() / 100 != 2) throw new ResponseStatusException(
                HttpStatus.BAD_GATEWAY,
                "유튜브 API 요청이 실패했어요 (HTTP " + response.statusCode() + ")."
            );
            var value = json.readTree(response.body());
            if (cache.size() > 500) cache.clear();
            cache.put(cacheKey, new Cached(System.currentTimeMillis(), value));
            return value;
        } catch (java.io.IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "유튜브에 연결할 수 없어요.");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "요청이 중단됐어요.");
        }
    }

    private static String thumbnail(JsonNode snippet) {
        for (var size : List.of("high", "medium", "default")) {
            String url = snippet.path("thumbnails").path(size).path("url").asString("");
            if (!url.isEmpty()) return url;
        }
        return "";
    }

    /** Full details for up to 50 video ids, in the given order. */
    ArrayNode videos(List<String> ids) {
        var result = json.createArrayNode();
        if (ids.isEmpty()) return result;
        var data = call(
            "videos",
            Map.of(
                "part",
                "snippet,statistics,contentDetails",
                "id",
                String.join(",", ids),
                "hl",
                "ko"
            )
        );
        var byId = new HashMap<String, JsonNode>();
        for (var item : data.path("items")) byId.put(item.path("id").asString(), item);
        for (String id : ids) {
            var item = byId.get(id);
            if (item == null) continue;
            var snippet = item.path("snippet");
            long seconds = 0;
            try {
                seconds = Duration.parse(
                    item.path("contentDetails").path("duration").asString("PT0S")
                ).getSeconds();
            } catch (RuntimeException ignored) {}
            result
                .addObject()
                .put("id", id)
                .put("url", "https://www.youtube.com/watch?v=" + id)
                .put("title", snippet.path("title").asString(""))
                .put("channel", snippet.path("channelTitle").asString(""))
                .put("channelId", snippet.path("channelId").asString(""))
                .put("thumbnail", thumbnail(snippet))
                .put("publishedAt", snippet.path("publishedAt").asString(""))
                .put("description", snippet.path("description").asString(""))
                .put("views", item.path("statistics").path("viewCount").asLong(0))
                .put("likes", item.path("statistics").path("likeCount").asLong(0))
                .put("seconds", seconds)
                // Descriptions listing ingredients can be turned into recipes; most Shorts have none.
                .put(
                    "recipeReady",
                    RECIPE_HINT.matcher(snippet.path("description").asString("")).find()
                );
        }
        return result;
    }

    Optional<ObjectNode> video(String id) {
        if (!enabled()) return Optional.empty();
        var list = videos(List.of(id));
        return list.isEmpty() ? Optional.empty() : Optional.of((ObjectNode) list.get(0));
    }

    @GetMapping("/videos")
    ObjectNode search(
        @RequestParam String q,
        @RequestParam(defaultValue = "12") int max,
        @RequestParam(defaultValue = "relevance") String order
    ) {
        String query = q.trim();
        if (
            query.isEmpty() ||
            query.length() > 60 ||
            max < 1 ||
            max > 24 ||
            !Set.of("relevance", "viewCount", "date").contains(order)
        ) throw RecipeService.bad();
        var found = call(
            "search",
            Map.of(
                "part",
                "snippet",
                "type",
                "video",
                "maxResults",
                String.valueOf(max),
                "q",
                query + " 레시피",
                "regionCode",
                "KR",
                "relevanceLanguage",
                "ko",
                "safeSearch",
                "strict",
                "videoEmbeddable",
                "true",
                "order",
                order
            )
        );
        var ids = new ArrayList<String>();
        for (var item : found.path("items")) {
            String id = item.path("id").path("videoId").asString("");
            if (id.matches("[A-Za-z0-9_-]{11}")) ids.add(id);
        }
        var list = videos(ids);
        // Videos whose description holds a recipe come first, keeping YouTube order otherwise.
        var sorted = new ArrayList<JsonNode>();
        list.forEach(sorted::add);
        sorted.sort(Comparator.comparing((JsonNode v) -> !v.path("recipeReady").asBoolean()));
        var result = json.createObjectNode();
        result.putArray("videos").addAll(sorted);
        return result;
    }

    @GetMapping("/channels")
    ObjectNode channels(
        @RequestParam(defaultValue = "요리 레시피") String q,
        @RequestParam(defaultValue = "") String ids
    ) {
        if (q.length() > 60 || ids.length() > 2000) throw RecipeService.bad();
        var channelIds = new ArrayList<String>();
        for (String id : ids.split(","))
            if (id.matches("UC[A-Za-z0-9_-]{22}") && channelIds.size() < 30) channelIds.add(id);
        if (channelIds.isEmpty()) {
            var found = call(
                "search",
                Map.of(
                    "part",
                    "snippet",
                    "type",
                    "channel",
                    "maxResults",
                    "18",
                    "q",
                    q,
                    "regionCode",
                    "KR",
                    "relevanceLanguage",
                    "ko"
                )
            );
            for (var item : found.path("items")) {
                String id = item.path("id").path("channelId").asString("");
                if (!id.isEmpty()) channelIds.add(id);
            }
        }
        var result = json.createObjectNode();
        var list = result.putArray("channels");
        if (channelIds.isEmpty()) return result;
        var data = call(
            "channels",
            Map.of("part", "snippet,statistics", "id", String.join(",", channelIds), "hl", "ko")
        );
        var rows = new ArrayList<ObjectNode>();
        for (var item : data.path("items")) {
            var snippet = item.path("snippet");
            String handle = snippet.path("customUrl").asString("");
            rows.add(
                json
                    .createObjectNode()
                    .put("id", item.path("id").asString())
                    .put("name", snippet.path("title").asString(""))
                    .put("thumbnail", thumbnail(snippet))
                    .put(
                        "url",
                        handle.isEmpty()
                            ? "https://www.youtube.com/channel/" + item.path("id").asString()
                            : "https://www.youtube.com/" + handle
                    )
                    .put(
                        "subscribers",
                        item.path("statistics").path("hiddenSubscriberCount").asBoolean(false)
                            ? -1
                            : item.path("statistics").path("subscriberCount").asLong(0)
                    )
                    .put("videoCount", item.path("statistics").path("videoCount").asLong(0))
            );
        }
        rows.sort(
            Comparator.comparingLong((ObjectNode r) -> r.path("subscribers").asLong()).reversed()
        );
        rows.forEach(list::add);
        return result;
    }
}
