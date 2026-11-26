package kr.hankki;

import java.io.IOException;
import java.nio.file.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.*;

/** Views, rankings, reviews, problem reports and analysed video channels for server-generated recipes. */
@RestController
@RequestMapping("/api")
class RecipeStats {

    private static final String ID = "ai-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}";
    private static final String VIEWER = "[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}";
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");
    private static final Set<String> REASONS = Set.of(
        "분량이 이상해요",
        "조리 순서가 이상해요",
        "알레르기 표기가 틀려요",
        "사진이 요리와 달라요",
        "기타"
    );
    private final Path directory;
    private final ObjectMapper json;
    private final DocumentDatabase database;
    private final Moderation moderation;
    // One counted view per viewer and recipe every 30 minutes keeps rankings from being inflated by reopening.
    private final Map<String, Long> recentViews = new ConcurrentHashMap<>();

    RecipeStats(
        ObjectMapper json,
        DocumentDatabase database,
        Moderation moderation,
        @Value("${RECIPE_STATS_STORAGE:.recipe-stats}") String directory
    ) {
        this.json = json;
        this.database = database;
        this.moderation = moderation;
        this.directory = Path.of(directory);
    }

    /** Called by the recommendation API so only server-reviewed recipes can appear in rankings. */
    synchronized void remember(ObjectNode recipe) throws IOException {
        Files.createDirectories(directory);
        var entry = json.createObjectNode();
        entry.set("recipe", recipe.deepCopy());
        entry.put("createdAt", Instant.now().toString());
        entry.putArray("views");
        entry.putArray("reviews");
        entry.putArray("reports");
        save(recipe.path("id").asString(), entry);
    }

    private DocumentDatabase.Store store() throws IOException {
        return database.open(directory, "(?:" + ID + "|channels)");
    }

    private ObjectNode read(String id) throws IOException {
        if (!id.matches(ID)) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        var entry = store().read(id);
        if (
            entry == null || entry.path("hidden").asBoolean(false)
        ) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        return entry;
    }

    private void save(String id, JsonNode entry) throws IOException {
        var store = store();
        synchronized (store) {
            store.recipes();
            store.save(id, (ObjectNode) entry);
        }
    }

    private Collection<ObjectNode> all() throws IOException {
        var rows = new ArrayList<ObjectNode>();
        for (String id : store().ids(null, Integer.MAX_VALUE))
            if (id.matches(ID)) {
                var entry = store().read(id);
                if (!entry.path("hidden").asBoolean(false)) rows.add(entry);
            }
        return rows;
    }

    void importReports() throws IOException {
        for (var entry : all())
            if (!entry.path("reports").isEmpty()) moderation.importLegacy(
                entry.path("recipe").path("id").asString(),
                entry.path("reports")
            );
    }

    synchronized void hide(String id) throws IOException {
        var entry = read(id);
        entry.put("hidden", true);
        save(id, entry);
    }

    /** A recipe already made from this YouTube video, so the same video is never analysed (and paid for) twice. */
    Optional<ObjectNode> findByVideo(String videoId) throws IOException {
        var store = store();
        synchronized (store) {
            return store.recipes().video(videoId);
        }
    }

    /** Browse every reviewed recipe without new AI calls: search, filters, sorting and paging. */
    @GetMapping("/recipes")
    ObjectNode catalog(
        @RequestParam(defaultValue = "") String q,
        @RequestParam(defaultValue = "all") String cuisine,
        @RequestParam(defaultValue = "0") int maxTime,
        @RequestParam(defaultValue = "-1") int level,
        @RequestParam(defaultValue = "0") int caloriesMax,
        @RequestParam(defaultValue = "") String source,
        @RequestParam(defaultValue = "latest") String sort,
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(defaultValue = "20") int size
    ) throws IOException {
        if (
            q.length() > 60 ||
            page < 0 ||
            page > 500 ||
            size < 1 ||
            size > 40 ||
            !Set.of("latest", "popular", "time", "name", "rating", "calories").contains(sort) ||
            !(cuisine.equals("all") || RecipeService.CUISINES.contains(cuisine)) ||
            !Set.of("", "video", "ai").contains(source)
        ) throw RecipeService.bad();
        var store = store();
        synchronized (store) {
            return store
                .recipes()
                .catalog(q, cuisine, maxTime, level, caloriesMax, source, sort, page, size);
        }
    }

    private static String viewer(JsonNode body) {
        String value = body.path("viewer").asString("");
        if (!value.matches(VIEWER)) throw RecipeService.bad();
        return value;
    }

    private static String text(JsonNode body, String key, int limit, boolean required) {
        String value = body.path(key).asString("").trim();
        if (
            (required && value.isEmpty()) || value.length() > limit
        ) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "입력 내용을 확인해주세요.");
        return value;
    }

    private ObjectNode summary(ObjectNode entry, long views) {
        var result = json.createObjectNode();
        result.set("recipe", entry.get("recipe"));
        result.put("views", views);
        var reviews = entry.path("reviews");
        double sum = 0;
        for (var review : reviews) sum += review.path("rating").asInt();
        result.put("reviewCount", reviews.size());
        result.put(
            "rating",
            reviews.isEmpty() ? 0 : Math.round((sum / reviews.size()) * 10) / 10.0
        );
        return result;
    }

    @GetMapping("/recipes/{id}")
    ObjectNode recipe(@PathVariable String id) throws IOException {
        var entry = read(id);
        return summary(entry, entry.path("views").size());
    }

    @PostMapping("/recipes/{id}/view")
    synchronized ObjectNode view(
        @PathVariable String id,
        @RequestBody JsonNode body
    ) throws IOException {
        String viewer = viewer(body);
        var entry = read(id);
        long now = System.currentTimeMillis();
        recentViews.entrySet().removeIf(e -> now - e.getValue() >= 30 * 60 * 1000L);
        if (recentViews.size() >= 20000) return summary(entry, entry.path("views").size());
        Long last = recentViews.get(viewer + id);
        if (last == null || now - last > 30 * 60 * 1000) {
            recentViews.put(viewer + id, now);
            var views = (ArrayNode) entry.get("views");
            views.add(now);
            while (views.size() > 20000) views.remove(0);
            save(id, entry);
        }
        return summary(entry, entry.path("views").size());
    }

    @GetMapping("/rankings")
    ObjectNode rankings(@RequestParam(defaultValue = "today") String period) throws IOException {
        long since = switch (period) {
            case "today" -> LocalDate.now(SEOUL).atStartOfDay(SEOUL).toInstant().toEpochMilli();
            case "week" -> Instant.now().minus(Duration.ofDays(7)).toEpochMilli();
            case "all" -> 0;
            default -> throw RecipeService.bad();
        };
        var store = store();
        synchronized (store) {
            return store.recipes().rankings(period, since);
        }
    }

    private ObjectNode reviewList(ObjectNode entry) {
        var result = summary(entry, entry.path("views").size());
        result.remove("recipe");
        var reviews = result.putArray("reviews");
        var all = new ArrayList<JsonNode>();
        entry.path("reviews").forEach(all::add);
        all.sort(Comparator.comparing((JsonNode r) -> r.path("createdAt").asString("")).reversed());
        for (var review : all) {
            var copy = ((ObjectNode) review).deepCopy();
            copy.remove("viewer");
            reviews.add(copy);
        }
        return result;
    }

    @GetMapping("/recipes/{id}/reviews")
    ObjectNode reviews(@PathVariable String id) throws IOException {
        return reviewList(read(id));
    }

    @PostMapping("/recipes/{id}/reviews")
    @ResponseStatus(HttpStatus.CREATED)
    synchronized ObjectNode review(
        @PathVariable String id,
        @RequestBody JsonNode body
    ) throws IOException {
        String viewer = viewer(body);
        var rating = body.path("rating");
        if (!RecipeService.number(rating, 1, 5)) throw RecipeService.bad();
        var entry = read(id);
        var reviews = (ArrayNode) entry.get("reviews");
        // One review per device: writing again replaces the earlier one.
        for (int i = reviews.size() - 1; i >= 0; i--) if (
            viewer.equals(reviews.get(i).path("viewer").asString())
        ) reviews.remove(i);
        reviews
            .addObject()
            .put("id", UUID.randomUUID().toString())
            .put("viewer", viewer)
            .put("createdAt", Instant.now().toString())
            .put("author", text(body, "author", 24, true))
            .put("rating", rating.asInt())
            .put("content", text(body, "content", 400, false));
        save(id, entry);
        return reviewList(entry);
    }

    @PostMapping("/recipes/{id}/reports")
    @ResponseStatus(HttpStatus.CREATED)
    synchronized Map<String, Boolean> report(
        @PathVariable String id,
        @RequestBody JsonNode body
    ) throws IOException {
        String viewer = viewer(body);
        String reason = body.path("reason").asString("");
        if (!REASONS.contains(reason)) throw RecipeService.bad();
        var entry = read(id);
        moderation.submit("recipe", id, "", body);
        return Map.of("received", true);
    }

    /** Remembers channels whose videos were analysed in the app, so the channel list reflects real use. */
    synchronized void recordChannel(
        String author,
        String videoId,
        String title,
        String channelId
    ) throws IOException {
        if (author.isBlank()) return;
        var channels = store().read("channels");
        if (channels == null) channels = json.createObjectNode();
        var channel = channels.has(author)
            ? (ObjectNode) channels.get(author)
            : channels.putObject(author).put("name", author).put("analyses", 0);
        channel
            .put("analyses", channel.path("analyses").asInt() + 1)
            .put("updatedAt", Instant.now().toString());
        if (channelId.matches("UC[A-Za-z0-9_-]{22}")) channel.put("channelId", channelId);
        var videos = channel.has("videos")
            ? (ObjectNode) channel.get("videos")
            : channel.putObject("videos");
        if (videos.size() < 200 || videos.has(videoId)) videos.put(videoId, title);
        save("channels", channels);
    }

    @GetMapping("/channels")
    ObjectNode channels() throws IOException {
        var rows = new ArrayList<ObjectNode>();
        var channels = store().read("channels");
        if (channels != null) for (var channel : channels) {
            var row = json
                .createObjectNode()
                .put("name", channel.path("name").asString())
                .put("analyses", channel.path("analyses").asInt())
                .put("updatedAt", channel.path("updatedAt").asString(""))
                .put("channelId", channel.path("channelId").asString(""));
            var videos = row.putArray("videos");
            for (var entry : channel.path("videos").properties())
                videos
                    .addObject()
                    .put("url", "https://www.youtube.com/watch?v=" + entry.getKey())
                    .put("title", entry.getValue().asString());
            rows.add(row);
        }
        rows.sort(Comparator.comparingInt((ObjectNode r) -> r.path("analyses").asInt()).reversed());
        var result = json.createObjectNode();
        var list = result.putArray("channels");
        rows.forEach(list::add);
        return result;
    }
}
