package kr.hankki;

import java.io.IOException;
import java.nio.file.*;
import java.time.Instant;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.*;
import tools.jackson.databind.node.*;

@RestController
@RequestMapping("/api/community/posts")
class Community {

    private static final String ID = "[0-9]{13}-[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}";
    private final Path directory;
    private final ObjectMapper json;
    private final DocumentDatabase database;
    private final Moderation moderation;

    Community(
        ObjectMapper json,
        DocumentDatabase database,
        Moderation moderation,
        @Value("${COMMUNITY_STORAGE:.community}") String directory
    ) {
        this.json = json;
        this.database = database;
        this.moderation = moderation;
        this.directory = Path.of(directory);
    }

    private DocumentDatabase.Store store() throws IOException {
        return database.open(directory, ID);
    }

    private ObjectNode read(String id) throws IOException {
        if (!id.matches(ID)) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        var post = store().read(id);
        if (post == null) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        return post;
    }

    private void save(ObjectNode post) throws IOException {
        store().save(post.path("id").asString(), post);
    }

    private ObjectNode view(ObjectNode post, String viewer, boolean detail) {
        var result = post.deepCopy();
        result.remove("ownerHash");
        for (var item : result.path("comments")) ((ObjectNode) item).remove("ownerHash");
        var likes = result.remove("likes");
        boolean liked = false;
        for (var like : likes) if (like.asString().equals(viewer)) liked = true;
        result
            .put("liked", liked)
            .put("likeCount", likes.size())
            .put("commentCount", result.path("comments").size());
        if (!detail) result.remove("comments");
        if (result.remove("mime") != null) result.put(
            "image",
            "/api/community/posts/" + post.get("id").asString() + "/image"
        );
        else result.putNull("image");
        return result;
    }

    @GetMapping
    ObjectNode feed(
        @RequestParam(required = false) String viewer,
        @RequestParam(required = false) String cursor
    ) throws IOException {
        var result = json.createObjectNode();
        var posts = result.putArray("posts");
        result.putNull("nextCursor");
        var ids = store().ids(cursor, 21);
        for (String id : ids.stream().limit(20).toList()) posts.add(view(read(id), viewer, false));
        if (ids.size() > 20) result.put("nextCursor", ids.get(19));
        return result;
    }

    @GetMapping("/{id}")
    ObjectNode detail(
        @PathVariable String id,
        @RequestParam(required = false) String viewer
    ) throws IOException {
        return view(read(id), viewer, true);
    }

    @GetMapping("/{id}/image")
    ResponseEntity<byte[]> image(@PathVariable String id) throws IOException {
        var mime = read(id).path("mime").asString("");
        if (mime.isEmpty()) throw new ResponseStatusException(
            HttpStatus.NOT_FOUND,
            "사진을 찾을 수 없어요."
        );
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(mime))
            .header("X-Content-Type-Options", "nosniff")
            .body(Files.readAllBytes(directory.resolve(id + ".image")));
    }

    private String field(JsonNode data, String key, int limit) {
        var value = data.path(key);
        if (
            !value.isString() ||
            value.asString().isBlank() ||
            value.asString().trim().length() > limit
        ) throw new ResponseStatusException(
            HttpStatus.BAD_REQUEST,
            "게시글 입력 내용을 확인해주세요."
        );
        return value.asString().trim();
    }

    private String viewer(JsonNode data) {
        String value = field(data, "viewer", 36);
        if (
            !value.matches("[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}")
        ) throw RecipeService.bad();
        return value;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    synchronized ObjectNode create(@RequestBody JsonNode data) throws IOException {
        String id = System.currentTimeMillis() + "-" + UUID.randomUUID();
        var post = json
            .createObjectNode()
            .put("id", id)
            .put("createdAt", Instant.now().toString())
            .put("revision", 0)
            .put("author", field(data, "author", 24))
            .put("title", field(data, "title", 80))
            .put("content", field(data, "content", 1200));
        String ownerToken = Ownership.issue();
        post.put("ownerHash", Ownership.hash(ownerToken));
        post.putArray("likes");
        post.putArray("comments");
        Files.createDirectories(directory);
        Path image = directory.resolve(id + ".image");
        var upload = data.path("image");
        if (!upload.isMissingNode() && !upload.isNull() && !upload.asString("").isEmpty()) {
            var photo = Upload.decode(upload.asString(), 2 * 1024 * 1024);
            Files.write(image, photo.bytes(), StandardOpenOption.CREATE_NEW);
            post.put("mime", photo.mime());
        }
        try {
            save(post);
        } catch (IOException e) {
            Files.deleteIfExists(image);
            throw e;
        }
        return view(post, null, false).put("ownerToken", ownerToken);
    }

    @PostMapping("/{id}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    synchronized ObjectNode comment(
        @PathVariable String id,
        @RequestBody JsonNode data
    ) throws IOException {
        String viewer = viewer(data);
        var post = read(id);
        String ownerToken = Ownership.issue();
        String commentId = UUID.randomUUID().toString();
        ((ArrayNode) post.get("comments"))
            .addObject()
            .put("ownerHash", Ownership.hash(ownerToken))
            .put("id", commentId)
            .put("createdAt", Instant.now().toString())
            .put("author", field(data, "author", 24))
            .put("content", field(data, "content", 400));
        revise(post);
        return view(post, viewer, true)
            .put("ownerToken", ownerToken)
            .put("ownedCommentId", commentId);
    }

    @PostMapping("/{id}/like")
    synchronized ObjectNode like(
        @PathVariable String id,
        @RequestBody JsonNode data
    ) throws IOException {
        String viewer = viewer(data);
        if (!data.path("liked").isBoolean()) throw RecipeService.bad();
        var post = read(id);
        var likes = (ArrayNode) post.get("likes");
        int index = -1;
        for (int i = 0; i < likes.size(); i++) if (likes.get(i).asString().equals(viewer)) index =
            i;
        if (data.get("liked").asBoolean() != index >= 0) {
            if (index >= 0) likes.remove(index);
            else likes.add(viewer);
            revise(post);
        }
        return view(post, viewer, true);
    }

    private void revise(ObjectNode post) throws IOException {
        post.put("revision", post.path("revision").asInt() + 1);
        save(post);
    }

    @PostMapping("/{id}/edit")
    synchronized ObjectNode edit(
        @PathVariable String id,
        @RequestBody JsonNode body
    ) throws IOException {
        var post = read(id);
        Ownership.require(post, body);
        String title = field(body, "title", 80),
            content = field(body, "content", 1200);
        post.put("title", title).put("content", content).put("updatedAt", Instant.now().toString());
        revise(post);
        return view(post, body.path("viewer").asString(""), true);
    }

    @PostMapping("/{id}/delete")
    synchronized Map<String, Boolean> delete(
        @PathVariable String id,
        @RequestBody JsonNode body
    ) throws IOException {
        Ownership.require(read(id), body);
        remove(id, "");
        return Map.of("deleted", true);
    }

    private ObjectNode findComment(ObjectNode post, String commentId) {
        for (var item : post.path("comments"))
            if (commentId.equals(item.path("id").asString())) return (ObjectNode) item;
        throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    }

    @PostMapping("/{id}/comments/{commentId}/edit")
    synchronized ObjectNode editComment(
        @PathVariable String id,
        @PathVariable String commentId,
        @RequestBody JsonNode body
    ) throws IOException {
        var post = read(id);
        var item = findComment(post, commentId);
        Ownership.require(item, body);
        item.put("content", field(body, "content", 400)).put("updatedAt", Instant.now().toString());
        revise(post);
        return view(post, body.path("viewer").asString(""), true);
    }

    @PostMapping("/{id}/comments/{commentId}/delete")
    synchronized ObjectNode deleteComment(
        @PathVariable String id,
        @PathVariable String commentId,
        @RequestBody JsonNode body
    ) throws IOException {
        var post = read(id);
        Ownership.require(findComment(post, commentId), body);
        removeComment(post, commentId);
        return view(post, body.path("viewer").asString(""), true);
    }

    private void removeComment(ObjectNode post, String commentId) throws IOException {
        var comments = (ArrayNode) post.get("comments");
        for (int i = comments.size() - 1; i >= 0; i--) if (
            commentId.equals(comments.get(i).path("id").asString())
        ) comments.remove(i);
        revise(post);
    }

    synchronized void remove(String id, String commentId) throws IOException {
        var post = read(id);
        if (!commentId.isEmpty()) {
            findComment(post, commentId);
            removeComment(post, commentId);
        } else {
            store().delete(id);
            Files.deleteIfExists(directory.resolve(id + ".image"));
        }
    }

    @PostMapping("/{id}/reports")
    Map<String, Boolean> reportPost(
        @PathVariable String id,
        @RequestBody JsonNode body
    ) throws IOException {
        read(id);
        moderation.submit("community", id, "", body);
        return Map.of("received", true);
    }

    @PostMapping("/{id}/comments/{commentId}/reports")
    Map<String, Boolean> reportComment(
        @PathVariable String id,
        @PathVariable String commentId,
        @RequestBody JsonNode body
    ) throws IOException {
        findComment(read(id), commentId);
        moderation.submit("community", id, commentId, body);
        return Map.of("received", true);
    }
}
