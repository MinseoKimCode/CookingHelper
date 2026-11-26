package kr.hankki;

import java.io.IOException;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Service
class OpenAi {

    final ObjectMapper json;
    private final Environment env;
    private final HttpClient client = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10))
        .build();

    OpenAi(Environment env, ObjectMapper json) {
        this.env = env;
        this.json = json;
    }

    boolean enabled() {
        return !env.getProperty("OPENAI_API_KEY", "").isBlank();
    }

    JsonNode call(String path, Object body) {
        if (!enabled()) throw new ResponseStatusException(
            HttpStatus.SERVICE_UNAVAILABLE,
            "서버에 OpenAI API 키를 설정해주세요."
        );
        var request = HttpRequest.newBuilder(
            URI.create(
                env
                    .getProperty("OPENAI_BASE_URL", "https://api.openai.com/v1")
                    .replaceAll("/+$", "") +
                    "/" +
                    path
            )
        )
            .header("Authorization", "Bearer " + env.getProperty("OPENAI_API_KEY"))
            .header("Content-Type", "application/json")
            .timeout(Duration.ofSeconds(150))
            .POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)))
            .build();
        try {
            var response = client.send(
                request,
                HttpResponse.BodyHandlers.ofString(java.nio.charset.StandardCharsets.UTF_8)
            );
            if (response.statusCode() / 100 == 2) return json.readTree(response.body());
            String code = "";
            try {
                code = json.readTree(response.body()).path("error").path("code").asString("");
            } catch (tools.jackson.core.JacksonException ignored) {}
            String reason = switch (response.statusCode()) {
                case 401 -> "AI API 인증에 실패했어요. 서버의 API 키를 확인해주세요.";
                case 429 -> "AI API 사용 한도에 도달했어요. 결제 잔액과 요청 한도를 확인해주세요.";
                case 404 -> "AI 모델을 찾지 못했어요. 서버의 모델 설정과 접근 권한을 확인해주세요.";
                default -> "AI 요청이 실패했어요. 잠시 후 다시 시도해주세요.";
            };
            String detail = code.matches("[a-zA-Z0-9_]{1,80}") ? ", " + code : "";
            throw new ResponseStatusException(
                HttpStatus.BAD_GATEWAY,
                reason + " (HTTP " + response.statusCode() + detail + ")"
            );
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (IOException | tools.jackson.core.JacksonException ignored) {
        }
        throw failed();
    }

    static ResponseStatusException failed() {
        return new ResponseStatusException(
            HttpStatus.BAD_GATEWAY,
            "AI 응답을 받지 못했어요. 모델 설정과 사용 한도를 확인한 뒤 다시 시도해주세요."
        );
    }

    JsonNode structured(List<?> content, Object schema) {
        var data = call(
            "responses",
            Map.of(
                "model",
                env.getProperty("OPENAI_MODEL", "gpt-4.1-mini"),
                "store",
                false,
                "input",
                List.of(Map.of("role", "user", "content", content)),
                "text",
                Map.of(
                    "format",
                    Map.of(
                        "type",
                        "json_schema",
                        "name",
                        "result",
                        "strict",
                        true,
                        "schema",
                        schema
                    )
                )
            )
        );
        for (var output : data.path("output"))
            for (var item : output.path("content"))
                if ("output_text".equals(item.path("type").asString())) {
                    try {
                        return json.readTree(item.path("text").asString());
                    } catch (tools.jackson.core.JacksonException e) {
                        throw failed();
                    }
                }
        throw failed();
    }

    byte[] photo(String description) {
        var response = call(
            "images/generations",
            Map.of(
                "model",
                env.getProperty("OPENAI_IMAGE_MODEL", "gpt-image-1-mini"),
                "size",
                "1024x1024",
                "quality",
                "low",
                "output_format",
                "jpeg",
                "n",
                1,
                "prompt",
                "완성된 요리 한 접시의 사실적인 음식 사진. 글자 없이, 아래 요리 데이터에 나온 재료만 표현하세요.\n" +
                    description
            )
        );
        var encoded = response.at("/data/0/b64_json").asString("");
        if (encoded.isEmpty()) throw failed();
        try {
            return Base64.getDecoder().decode(encoded);
        } catch (IllegalArgumentException e) {
            throw failed();
        }
    }
}
