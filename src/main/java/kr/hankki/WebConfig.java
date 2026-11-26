package kr.hankki;

import java.net.Inet4Address;
import java.net.NetworkInterface;
import java.net.SocketException;
import java.util.LinkedHashSet;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
class WebConfig implements WebMvcConfigurer {

    private final String[] origins;

    WebConfig(@Value("${APP_ALLOWED_ORIGINS:}") String origins) throws SocketException {
        if (origins.isBlank()) {
            var local = new LinkedHashSet<String>();
            local.add("http://localhost:8081");
            local.add("http://127.0.0.1:8081");
            NetworkInterface.networkInterfaces()
                .flatMap(NetworkInterface::inetAddresses)
                .filter(address -> address instanceof Inet4Address && address.isSiteLocalAddress())
                .forEach(address -> local.add("http://" + address.getHostAddress() + ":8081"));
            origins = String.join(",", local);
        }
        this.origins = java.util.Arrays.stream(origins.split(","))
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .toArray(String[]::new);
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry
            .addMapping("/api/**")
            .allowedOrigins(origins)
            .allowedMethods("GET", "POST", "OPTIONS")
            .allowedHeaders("Content-Type", "X-Admin-Key");
    }
}
