package kr.hankki;

import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

record Upload(String mime, byte[] bytes) {
    static Upload decode(String uri, int limit) {
        int split = uri.indexOf(',');
        if (split<0 || split>30) throw RecipeApi.bad();
        String prefix = uri.substring(0,split);
        if (!prefix.matches("data:image/(jpeg|png|webp);base64")) throw RecipeApi.bad();
        if (uri.length()-split-1 > 4L*((limit+2)/3)) throw tooLarge();
        byte[] bytes;
        try { bytes = Base64.getDecoder().decode(uri.substring(split+1)); }
        catch (IllegalArgumentException e) { throw RecipeApi.bad(); }
        if (bytes.length>limit) throw tooLarge();
        String mime = prefix.substring(5,prefix.indexOf(';'));
        String header = HexFormat.of().formatHex(bytes,0,Math.min(12,bytes.length));
        boolean valid = switch(mime) {
            case "image/jpeg" -> header.startsWith("ffd8ff");
            case "image/png" -> header.startsWith("89504e470d0a1a0a");
            default -> header.startsWith("52494646") && header.endsWith("57454250") && bytes.length>=12;
        };
        if (!valid) throw RecipeApi.bad();
        return new Upload(mime,bytes);
    }
    private static ResponseStatusException tooLarge() {
        return new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,"첨부한 사진의 용량이 너무 커요.");
    }
}
