package kr.hankki;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Map;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@RestController
class VideoApi {
    private static final Pattern URL = Pattern.compile("https?://(?:(?:www\\.|m\\.)?youtube\\.com/(?:watch\\?(?:[^#\\s]*&)?v=|shorts/|live/)|youtu\\.be/)([A-Za-z0-9_-]{11})(?:[?&#][^\\s]*)?");
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    private final ObjectMapper json;
    VideoApi(ObjectMapper json) { this.json = json; }

    @PostMapping("/api/video") Map<String,String> video(@RequestBody JsonNode body) {
        String raw = body.path("url").asString("");
        var match = URL.matcher(raw);
        if (raw.length()>2048 || !match.matches()) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"YouTube 영상 공유 주소를 확인해주세요.");
        String source = "https://www.youtube.com/watch?v=" + match.group(1);
        URI endpoint = URI.create("https://www.youtube.com/oembed?format=json&url=" + URLEncoder.encode(source, StandardCharsets.UTF_8));
        try {
            var response = http.send(HttpRequest.newBuilder(endpoint).timeout(Duration.ofSeconds(10)).GET().build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode()!=200) throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,"공개 영상 정보를 가져올 수 없어요.");
            var meta = json.readTree(response.body());
            return Map.of("url",source,"title",meta.path("title").asString(""),"author",meta.path("author_name").asString(""));
        } catch (java.io.IOException e) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,"YouTube 연결을 확인해주세요.");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"요청이 중단됐어요.");
        }
    }
}
