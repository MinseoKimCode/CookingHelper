package kr.hankki;

import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

/** Transactional embedded persistence; legacy JSON is imported once and left intact. */
@Component
class DocumentDatabase {

    private final ObjectMapper json;
    private final Map<Path, Store> stores = new HashMap<>();

    DocumentDatabase(ObjectMapper json) {
        this.json = json;
    }

    synchronized Store open(Path directory, String pattern) throws IOException {
        Path path = directory.toAbsolutePath().normalize();
        if (stores.containsKey(path)) return stores.get(path);
        try {
            Files.createDirectories(path);
            var connection = DriverManager.getConnection(
                "jdbc:h2:file:" +
                    path.resolve("store").toString().replace('\\', '/') +
                    ";WRITE_DELAY=0"
            );
            try {
                Store store = new Store(connection, path, pattern, json);
                stores.put(path, store);
                return store;
            } catch (Exception e) {
                connection.close();
                throw e;
            }
        } catch (SQLException e) {
            throw new IOException("Database initialization failed", e);
        }
    }

    @PreDestroy
    synchronized void close() throws SQLException {
        for (var store : stores.values()) store.connection.close();
    }

    static class Store {

        private final Connection connection;
        private final ObjectMapper json;

        Store(Connection connection, Path path, String pattern, ObjectMapper json)
            throws SQLException, IOException
        {
            this.connection = connection;
            this.json = json;
            try (var statement = connection.createStatement()) {
                statement.execute(
                    "CREATE TABLE IF NOT EXISTS documents (id VARCHAR(200) PRIMARY KEY, payload CLOB NOT NULL)"
                );
                statement.execute(
                    "CREATE TABLE IF NOT EXISTS migrations (version INT PRIMARY KEY)"
                );
            }
            try (
                var statement = connection.createStatement();
                var rows = statement.executeQuery("SELECT version FROM migrations WHERE version=1")
            ) {
                if (rows.next()) return;
            }
            connection.setAutoCommit(false);
            try {
                try (var files = Files.list(path)) {
                    for (Path file : files
                        .filter(p ->
                            p
                                .getFileName()
                                .toString()
                                .matches(pattern + "\\.json")
                        )
                        .toList()) {
                        String name = file.getFileName().toString();
                        var node = json.readTree(Files.readString(file));
                        if (!(node instanceof ObjectNode object)) throw new IOException(
                            "Invalid legacy document: " + file
                        );
                        save(name.substring(0, name.length() - 5), object);
                    }
                }
                try (var statement = connection.createStatement()) {
                    statement.executeUpdate("INSERT INTO migrations VALUES (1)");
                }
                connection.commit();
            } catch (IOException | SQLException | RuntimeException e) {
                connection.rollback();
                throw e;
            } finally {
                connection.setAutoCommit(true);
            }
        }

        synchronized ObjectNode read(String id) throws IOException {
            try (
                var query = connection.prepareStatement("SELECT payload FROM documents WHERE id=?")
            ) {
                query.setString(1, id);
                try (var rows = query.executeQuery()) {
                    return rows.next() ? (ObjectNode) json.readTree(rows.getString(1)) : null;
                }
            } catch (SQLException e) {
                throw new IOException(e);
            }
        }

        private RecipeIndex recipeIndex;

        synchronized RecipeIndex recipes() throws IOException {
            if (recipeIndex == null) {
                try {
                    recipeIndex = new RecipeIndex(connection, json);
                } catch (SQLException e) {
                    throw new IOException(e);
                }
            }
            return recipeIndex;
        }

        synchronized void save(String id, ObjectNode value) throws IOException {
            boolean own = false;
            try {
                own = connection.getAutoCommit();
                if (own) connection.setAutoCommit(false);
                var previous = recipeIndex != null && value.has("recipe") ? read(id) : null;
                saveDocument(id, value);
                if (recipeIndex != null) recipeIndex.update(id, previous, value);
                if (own) connection.commit();
            } catch (SQLException | IOException | RuntimeException e) {
                try {
                    if (own) connection.rollback();
                } catch (SQLException rollback) {
                    e.addSuppressed(rollback);
                }
                if (e instanceof IOException io) throw io;
                throw new IOException(e);
            } finally {
                try {
                    if (own) connection.setAutoCommit(true);
                } catch (SQLException e) {
                    throw new IOException(e);
                }
            }
        }

        private void saveDocument(String id, ObjectNode value) throws IOException {
            try (
                var query = connection.prepareStatement(
                    "MERGE INTO documents (id, payload) KEY(id) VALUES (?, ?)"
                )
            ) {
                query.setString(1, id);
                query.setString(2, json.writeValueAsString(value));
                query.executeUpdate();
            } catch (SQLException e) {
                throw new IOException(e);
            }
        }

        synchronized void delete(String id) throws IOException {
            try (var query = connection.prepareStatement("DELETE FROM documents WHERE id=?")) {
                query.setString(1, id);
                query.executeUpdate();
            } catch (SQLException e) {
                throw new IOException(e);
            }
        }

        synchronized List<String> ids(String before, int limit) throws IOException {
            try (
                var query = connection.prepareStatement(
                    "SELECT id FROM documents WHERE id < ? ORDER BY id DESC LIMIT ?"
                )
            ) {
                query.setString(1, before == null ? "~" : before);
                query.setInt(2, limit);
                try (var rows = query.executeQuery()) {
                    var result = new ArrayList<String>();
                    while (rows.next()) result.add(rows.getString(1));
                    return result;
                }
            } catch (SQLException e) {
                throw new IOException(e);
            }
        }
    }
}
