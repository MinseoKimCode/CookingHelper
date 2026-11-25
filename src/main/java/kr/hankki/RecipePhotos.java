package kr.hankki;

import java.io.IOException;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.TimeUnit;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import tools.jackson.databind.JsonNode;

@RestController
class RecipePhotos {
    private final OpenAi ai;
    private final Path directory;
    private final Object[] locks = new Object[64];
    RecipePhotos(OpenAi ai, @Value("${RECIPE_PHOTO_STORAGE:.recipe-photos}") String directory) {
        this.ai = ai;
        this.directory = Path.of(directory);
        Arrays.setAll(locks, i -> new Object());
    }
    UUID register(JsonNode recipe) throws IOException {
        var id = UUID.randomUUID();
        Files.createDirectories(directory);
        Files.writeString(directory.resolve(id + ".json"), ai.json.writeValueAsString(Map.of("요리",recipe.path("name"),
            "재료",recipe.path("ingredients"),"조리법",recipe.path("steps"))), StandardOpenOption.CREATE_NEW);
        return id;
    }
    @GetMapping(value="/api/recipe-photos/{id}", produces=MediaType.IMAGE_JPEG_VALUE)
    ResponseEntity<byte[]> image(@PathVariable UUID id) throws IOException {
        Path image = directory.resolve(id + ".jpg");
        synchronized (locks[Math.floorMod(id.hashCode(), locks.length)]) {
            if (!Files.exists(image)) {
                Path description = directory.resolve(id + ".json");
                if (!Files.exists(description)) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "사진을 찾을 수 없어요.");
                byte[] bytes = ai.photo(Files.readString(description));
                Path temp = Files.createTempFile(directory,"image-",".tmp");
                try {
                    Files.write(temp,bytes);
                    Files.move(temp,image,StandardCopyOption.ATOMIC_MOVE);
                } finally { Files.deleteIfExists(temp); }
            }
        }
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(30,TimeUnit.DAYS)).body(Files.readAllBytes(image));
    }
}
