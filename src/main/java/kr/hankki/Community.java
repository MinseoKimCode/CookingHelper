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
    Community(ObjectMapper json,@Value("${COMMUNITY_STORAGE:.community}") String directory) {
        this.json = json;
        this.directory = Path.of(directory);
    }
    private ObjectNode read(String id) throws IOException {
        if (!id.matches(ID) || !Files.isRegularFile(directory.resolve(id+".json")))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,"게시글을 찾을 수 없어요.");
        return (ObjectNode)json.readTree(Files.readString(directory.resolve(id+".json")));
    }
    private void save(ObjectNode post) throws IOException {
        Path temp = Files.createTempFile(directory,"post-",".tmp");
        try {
            Files.writeString(temp,json.writeValueAsString(post));
            Files.move(temp,directory.resolve(post.get("id").asString()+".json"),StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);
        } finally { Files.deleteIfExists(temp); }
    }
    private ObjectNode view(ObjectNode post,String viewer,boolean detail) {
        var result = post.deepCopy();
        var likes = result.remove("likes");
        boolean liked = false;
        for (var like : likes) if (like.asString().equals(viewer)) liked = true;
        result.put("liked",liked).put("likeCount",likes.size()).put("commentCount",result.path("comments").size());
        if (!detail) result.remove("comments");
        if (result.remove("mime") != null) result.put("image","/api/community/posts/"+post.get("id").asString()+"/image");
        else result.putNull("image");
        return result;
    }
    @GetMapping ObjectNode feed(@RequestParam(required=false) String viewer,@RequestParam(required=false) String cursor) throws IOException {
        var result = json.createObjectNode();
        var posts = result.putArray("posts");
        result.putNull("nextCursor");
        if (!Files.isDirectory(directory)) return result;
        try (var files = Files.list(directory)) {
            var ids = files.map(p->p.getFileName().toString()).filter(n->n.endsWith(".json"))
                .map(n->n.substring(0,n.length()-5)).filter(n->n.matches(ID) && (cursor==null || n.compareTo(cursor)<0))
                .sorted(Comparator.reverseOrder()).limit(21).toList();
            for (String id : ids.stream().limit(20).toList()) posts.add(view(read(id),viewer,false));
            if (ids.size()>20) result.put("nextCursor",ids.get(19));
        }
        return result;
    }
    @GetMapping("/{id}") ObjectNode detail(@PathVariable String id,@RequestParam(required=false) String viewer) throws IOException {
        return view(read(id),viewer,true);
    }
    @GetMapping("/{id}/image") ResponseEntity<byte[]> image(@PathVariable String id) throws IOException {
        var mime = read(id).path("mime").asString("");
        if (mime.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"사진을 찾을 수 없어요.");
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(mime)).header("X-Content-Type-Options","nosniff")
            .body(Files.readAllBytes(directory.resolve(id+".image")));
    }
    private String field(JsonNode data,String key,int limit) {
        var value = data.path(key);
        if (!value.isString() || value.asString().isBlank() || value.asString().trim().length()>limit)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"게시글 입력 내용을 확인해주세요.");
        return value.asString().trim();
    }
    private String viewer(JsonNode data) {
        String value = field(data,"viewer",36);
        if (!value.matches("[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}")) throw RecipeApi.bad();
        return value;
    }
    @PostMapping @ResponseStatus(HttpStatus.CREATED)
    ObjectNode create(@RequestBody JsonNode data) throws IOException {
        String id = System.currentTimeMillis()+"-"+UUID.randomUUID();
        var post = json.createObjectNode().put("id",id).put("createdAt",Instant.now().toString()).put("revision",0)
            .put("author",field(data,"author",24)).put("title",field(data,"title",80)).put("content",field(data,"content",1200));
        post.putArray("likes");
        post.putArray("comments");
        Files.createDirectories(directory);
        Path image = directory.resolve(id+".image");
        var upload = data.path("image");
        if (!upload.isMissingNode() && !upload.isNull() && !upload.asString("").isEmpty()) {
            var photo = Upload.decode(upload.asString(),2*1024*1024);
            Files.write(image,photo.bytes(),StandardOpenOption.CREATE_NEW);
            post.put("mime",photo.mime());
        }
        try { save(post); }
        catch (IOException e) { Files.deleteIfExists(image); throw e; }
        return view(post,null,false);
    }
    @PostMapping("/{id}/comments") @ResponseStatus(HttpStatus.CREATED)
    synchronized ObjectNode comment(@PathVariable String id,@RequestBody JsonNode data) throws IOException {
        String viewer = viewer(data);
        var post = read(id);
        ((ArrayNode)post.get("comments")).addObject().put("id",UUID.randomUUID().toString()).put("createdAt",Instant.now().toString())
            .put("author",field(data,"author",24)).put("content",field(data,"content",400));
        revise(post);
        return view(post,viewer,true);
    }
    @PostMapping("/{id}/like")
    synchronized ObjectNode like(@PathVariable String id,@RequestBody JsonNode data) throws IOException {
        String viewer = viewer(data);
        if (!data.path("liked").isBoolean()) throw RecipeApi.bad();
        var post = read(id);
        var likes = (ArrayNode)post.get("likes");
        int index = -1;
        for (int i=0;i<likes.size();i++) if (likes.get(i).asString().equals(viewer)) index=i;
        if (data.get("liked").asBoolean() != (index>=0)) {
            if (index>=0) likes.remove(index);
            else likes.add(viewer);
            revise(post);
        }
        return view(post,viewer,true);
    }
    private void revise(ObjectNode post) throws IOException {
        post.put("revision",post.path("revision").asInt()+1);
        save(post);
    }
}
