package kr.hankki;

import java.io.IOException;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.node.ObjectNode;

@RestController
@RequestMapping("/api/admin")
class AdminApi {

    private final Moderation moderation;
    private final RecipeStats stats;
    private final Community community;

    AdminApi(Moderation moderation, RecipeStats stats, Community community) {
        this.moderation = moderation;
        this.stats = stats;
        this.community = community;
    }

    @GetMapping("/reports")
    ObjectNode reports(
        @RequestHeader(value = "X-Admin-Key", defaultValue = "") String key
    ) throws IOException {
        moderation.authorize(key);
        stats.importReports();
        return moderation.list();
    }

    @PostMapping("/reports/{id}/resolve")
    Map<String, Boolean> resolve(
        @RequestHeader(value = "X-Admin-Key", defaultValue = "") String key,
        @PathVariable String id,
        @RequestBody JsonNode body
    ) throws IOException {
        moderation.authorize(key);
        String action = body.path("action").asString("");
        if (!action.equals("dismiss") && !action.equals("remove")) throw RecipeService.bad();
        var report = moderation.read(id);
        if (!"resolved".equals(report.path("status").asString()) && action.equals("remove")) {
            try {
                if (report.path("kind").asString().equals("recipe")) stats.hide(
                    report.path("target").asString()
                );
                else community.remove(
                    report.path("target").asString(),
                    report.path("comment").asString("")
                );
            } catch (ResponseStatusException e) {
                if (e.getStatusCode() != HttpStatus.NOT_FOUND) throw e;
            }
        }
        moderation.resolve(report);
        return Map.of("resolved", true);
    }
}
