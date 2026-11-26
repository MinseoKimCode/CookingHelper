package kr.hankki;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.*;

@Component
class Moderation {

    private final String adminKey;
    private final Path directory;
    private final DocumentDatabase database;
    private final ObjectMapper json;

    Moderation(
        DocumentDatabase database,
        ObjectMapper json,
        @Value("${ADMIN_KEY:}") String adminKey,
        @Value("${MODERATION_STORAGE:.moderation}") String directory
    ) {
        this.database = database;
        this.json = json;
        this.adminKey = adminKey;
        this.directory = Path.of(directory);
    }

    void authorize(String key) {
        if (
            adminKey.isBlank() ||
            !MessageDigest.isEqual(
                adminKey.getBytes(StandardCharsets.UTF_8),
                key.getBytes(StandardCharsets.UTF_8)
            )
        ) throw new ResponseStatusException(HttpStatus.FORBIDDEN, "관리자 인증이 필요해요.");
    }

    synchronized void submit(
        String kind,
        String target,
        String comment,
        JsonNode body
    ) throws IOException {
        String reason = body.path("reason").asString("").trim();
        String detail = body.path("detail").asString("").trim();
        if (
            reason.isEmpty() || reason.length() > 80 || detail.length() > 400
        ) throw RecipeService.bad();
        String viewer = body.path("viewer").asString("");
        if (
            !viewer.matches("[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}")
        ) throw RecipeService.bad();
        String id = "report-" + UUID.randomUUID();
        store().save(
            id,
            json
                .createObjectNode()
                .put("id", id)
                .put("kind", kind)
                .put("target", target)
                .put("comment", comment)
                .put("reason", reason)
                .put("detail", detail)
                .put("status", "open")
                .put("createdAt", Instant.now().toString())
        );
    }

    // Stable IDs make import of pre-existing recipe reports safe to repeat.
    void importLegacy(String target, JsonNode reports) throws IOException {
        var store = store();
        for (int i = 0; i < reports.size(); i++) {
            String id = "legacy-" + target + "-" + i;
            if (store.read(id) != null) continue;
            var copy = ((ObjectNode) reports.get(i)).deepCopy();
            copy.remove("viewer");
            copy.put("id", id)
                .put("kind", "recipe")
                .put("target", target)
                .put("comment", "")
                .put("status", "open");
            store.save(id, copy);
        }
    }

    private DocumentDatabase.Store store() throws IOException {
        return database.open(directory, "report-.*");
    }

    ObjectNode list() throws IOException {
        var result = json.createObjectNode();
        var reports = result.putArray("reports");
        for (String id : store().ids(null, Integer.MAX_VALUE)) {
            var report = store().read(id);
            if ("open".equals(report.path("status").asString())) reports.add(report);
        }
        return result;
    }

    ObjectNode read(String id) throws IOException {
        var report = store().read(id);
        if (report == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        return report;
    }

    void resolve(ObjectNode report) throws IOException {
        report.put("status", "resolved").put("resolvedAt", Instant.now().toString());
        store().save(report.path("id").asString(), report);
    }
}
