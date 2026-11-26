package kr.hankki;

import java.io.IOException;
import java.util.Map;
import org.springframework.web.bind.annotation.*;
import tools.jackson.databind.JsonNode;

/** HTTP boundary; generation, validation and video conversion live in RecipeService. */
@RestController
@RequestMapping("/api")
class RecipeApi {

    private final RecipeService recipes;

    RecipeApi(RecipeService recipes) {
        this.recipes = recipes;
    }

    @GetMapping("/status")
    Map<?, ?> status() {
        return recipes.status();
    }

    @PostMapping("/recognize")
    Map<?, ?> recognize(@RequestBody JsonNode body) {
        return recipes.recognize(body);
    }

    @PostMapping("/recommend")
    Map<?, ?> recommend(@RequestBody JsonNode body) throws IOException {
        return recipes.recommend(body);
    }

    @PostMapping("/explain")
    JsonNode explain(@RequestBody JsonNode body) {
        return recipes.explain(body);
    }
}
