package kr.hankki;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;

final class Ownership {

    static String issue() {
        return (
            UUID.randomUUID().toString().replace("-", "") +
            UUID.randomUUID().toString().replace("-", "")
        );
    }

    static String hash(String value) {
        try {
            return HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))
            );
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    static void require(JsonNode resource, JsonNode body) {
        String token = body.path("ownerToken").asString("");
        String expected = resource.path("ownerHash").asString("");
        if (
            !token.matches("[0-9a-f]{64}") ||
            expected.isEmpty() ||
            !MessageDigest.isEqual(
                hash(token).getBytes(StandardCharsets.UTF_8),
                expected.getBytes(StandardCharsets.UTF_8)
            )
        ) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "작성 권한이 없어요.");
    }
}
