package kr.hankki;

import java.io.IOException;
import java.sql.*;
import java.util.*;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

/** Query projection, updated in the same transaction as the source document. */
final class RecipeIndex {

    private final Connection connection;
    private final ObjectMapper json;

    RecipeIndex(Connection connection, ObjectMapper json) throws SQLException, IOException {
        this.connection = connection;
        this.json = json;
        try (var sql = connection.createStatement()) {
            sql.execute(
                "CREATE TABLE IF NOT EXISTS recipe_catalog (id VARCHAR(200) PRIMARY KEY, recipe CLOB NOT NULL, dish_key VARCHAR(1000) NOT NULL, recipe_name VARCHAR(1000), searchable CLOB, cuisine VARCHAR(100), cook_time INT, recipe_level INT, calories INT, is_video BOOLEAN, video_id VARCHAR(100), created_at VARCHAR(100), hidden BOOLEAN, views BIGINT, review_count INT, rating DOUBLE)"
            );
            sql.execute(
                "CREATE INDEX IF NOT EXISTS recipe_video_idx ON recipe_catalog(video_id, hidden)"
            );
            sql.execute(
                "CREATE INDEX IF NOT EXISTS recipe_latest_idx ON recipe_catalog(hidden, created_at DESC, id)"
            );
            sql.execute(
                "CREATE INDEX IF NOT EXISTS recipe_filter_idx ON recipe_catalog(hidden, cuisine, cook_time)"
            );
            sql.execute(
                "CREATE TABLE IF NOT EXISTS recipe_view_events (recipe_id VARCHAR(200), viewed_at BIGINT, amount INT, PRIMARY KEY(recipe_id, viewed_at))"
            );
            sql.execute(
                "CREATE INDEX IF NOT EXISTS recipe_views_time_idx ON recipe_view_events(viewed_at, recipe_id)"
            );
            try (var rows = sql.executeQuery("SELECT version FROM migrations WHERE version=2")) {
                if (rows.next()) return;
            }
        }
        connection.setAutoCommit(false);
        try {
            try (
                var sql = connection.createStatement();
                var rows = sql.executeQuery(
                    "SELECT id, payload FROM documents WHERE id LIKE 'ai-%'"
                )
            ) {
                while (rows.next()) {
                    var entry = json.readTree(rows.getString(2));
                    if (entry.has("recipe")) update(rows.getString(1), null, entry);
                }
            }
            try (var sql = connection.createStatement()) {
                sql.executeUpdate("INSERT INTO migrations VALUES (2)");
            }
            connection.commit();
        } catch (SQLException | RuntimeException e) {
            connection.rollback();
            throw e;
        } finally {
            connection.setAutoCommit(true);
        }
    }

    void update(String id, JsonNode previous, JsonNode entry) throws SQLException {
        if (!entry.has("recipe")) return;
        var recipe = entry.path("recipe");
        String name = recipe.path("name").asString("");
        var searchable = new StringBuilder(name.replace(" ", ""));
        for (var ingredient : recipe.path("ingredients"))
            searchable.append('\n').append(ingredient.path("name").asString(""));
        double sum = 0;
        for (var review : entry.path("reviews")) sum += review.path("rating").asInt();
        int count = entry.path("reviews").size();
        upsertMetadata(id, entry, recipe, name, searchable.toString(), count, sum);
        var oldViews = times(previous == null ? null : previous.path("views"));
        var nextViews = times(entry.path("views"));
        var times = new HashSet<>(oldViews.keySet());
        times.addAll(nextViews.keySet());
        try (
            var put = connection.prepareStatement(
                "MERGE INTO recipe_view_events KEY(recipe_id, viewed_at) VALUES (?,?,?)"
            );
            var remove = connection.prepareStatement(
                "DELETE FROM recipe_view_events WHERE recipe_id=? AND viewed_at=?"
            )
        ) {
            for (long time : times) {
                int old = oldViews.getOrDefault(time, 0),
                    next = nextViews.getOrDefault(time, 0);
                if (old == next) continue;
                if (next == 0) {
                    remove.setString(1, id);
                    remove.setLong(2, time);
                    remove.addBatch();
                } else {
                    put.setString(1, id);
                    put.setLong(2, time);
                    put.setInt(3, next);
                    put.addBatch();
                }
            }
            put.executeBatch();
            remove.executeBatch();
        }
    }

    private void upsertMetadata(
        String id,
        JsonNode entry,
        JsonNode recipe,
        String name,
        String searchable,
        int count,
        double sum
    ) throws SQLException {
        try (
            var query = connection.prepareStatement(
                "MERGE INTO recipe_catalog (id, recipe, dish_key, recipe_name, searchable, cuisine, cook_time, recipe_level, calories, is_video, video_id, created_at, hidden, views, review_count, rating) KEY(id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
            )
        ) {
            query.setString(1, id);
            query.setString(2, json.writeValueAsString(recipe));
            query.setString(3, recipe.path("menuKey").asString(name.replace(" ", "")));
            query.setString(4, name);
            query.setString(5, searchable);
            query.setString(6, recipe.path("cuisine").asString(""));
            query.setInt(7, recipe.path("time").asInt());
            query.setInt(8, recipe.path("level").asInt());
            if (recipe.has("calories")) query.setInt(9, recipe.path("calories").asInt());
            else query.setNull(9, Types.INTEGER);
            query.setBoolean(10, recipe.has("video"));
            query.setString(11, recipe.path("video").path("id").asString(""));
            query.setString(12, entry.path("createdAt").asString(""));
            query.setBoolean(13, entry.path("hidden").asBoolean(false));
            query.setLong(14, entry.path("views").size());
            query.setInt(15, count);
            query.setDouble(16, count == 0 ? 0 : Math.round((sum / count) * 10) / 10.0);
            query.executeUpdate();
        }
    }

    private static Map<Long, Integer> times(JsonNode list) {
        var result = new HashMap<Long, Integer>();
        if (list != null) for (var time : list) result.merge(time.asLong(), 1, Integer::sum);
        return result;
    }

    private static void bind(PreparedStatement query, List<Object> params) throws SQLException {
        for (int i = 0; i < params.size(); i++) query.setObject(i + 1, params.get(i));
    }

    private ObjectNode row(ResultSet rows) throws SQLException, IOException {
        var result = json
            .createObjectNode()
            .put("views", rows.getLong("views"))
            .put("reviewCount", rows.getInt("review_count"))
            .put("rating", rows.getDouble("rating"))
            .put("createdAt", rows.getString("created_at"));
        result.set("recipe", json.readTree(rows.getString("recipe")));
        return result;
    }

    ObjectNode catalog(
        String q,
        String cuisine,
        int maxTime,
        int level,
        int calories,
        String source,
        String sort,
        int page,
        int size
    ) throws IOException {
        var where = new StringBuilder("hidden=FALSE");
        var params = new ArrayList<Object>();
        if (!q.isEmpty()) {
            where.append(" AND LOCATE(?, searchable)>0");
            params.add(q.replace(" ", ""));
        }
        if (!cuisine.equals("all")) {
            where.append(" AND cuisine=?");
            params.add(cuisine);
        }
        if (maxTime > 0) {
            where.append(" AND cook_time<=?");
            params.add(maxTime);
        }
        if (level >= 0) {
            where.append(" AND recipe_level=?");
            params.add(level);
        }
        if (calories > 0) {
            where.append(" AND calories<=?");
            params.add(calories);
        }
        if (!source.isEmpty()) {
            where.append(" AND is_video=?");
            params.add(source.equals("video"));
        }
        String order =
            switch (sort) {
                case "popular" -> "views DESC";
                case "rating" -> "rating DESC";
                case "time" -> "cook_time ASC";
                case "calories" -> "COALESCE(calories,99999) ASC";
                case "name" -> "recipe_name ASC";
                default -> "created_at DESC";
            } + ", id ASC";
        try {
            int total;
            try (
                var query = connection.prepareStatement(
                    "SELECT COUNT(DISTINCT dish_key) FROM recipe_catalog WHERE " + where
                )
            ) {
                bind(query, params);
                try (var rows = query.executeQuery()) {
                    rows.next();
                    total = rows.getInt(1);
                }
            }
            var result = json
                .createObjectNode()
                .put("total", total)
                .put("page", page)
                .put("hasMore", (long) (page + 1) * size < total);
            var list = result.putArray("recipes");
            String sql =
                "SELECT * FROM (SELECT c.*, ROW_NUMBER() OVER(PARTITION BY dish_key ORDER BY " +
                order +
                ") AS position FROM recipe_catalog c WHERE " +
                where +
                ") WHERE position=1 ORDER BY " +
                order +
                " LIMIT ? OFFSET ?";
            try (var query = connection.prepareStatement(sql)) {
                var paging = new ArrayList<Object>(params);
                paging.add(size);
                paging.add((long) page * size);
                bind(query, paging);
                try (var rows = query.executeQuery()) {
                    while (rows.next()) list.add(row(rows));
                }
            }
            return result;
        } catch (SQLException e) {
            throw new IOException(e);
        }
    }

    Optional<ObjectNode> video(String videoId) throws IOException {
        try (
            var query = connection.prepareStatement(
                "SELECT recipe FROM recipe_catalog WHERE video_id=? AND hidden=FALSE ORDER BY created_at DESC, id LIMIT 1"
            )
        ) {
            query.setString(1, videoId);
            try (var rows = query.executeQuery()) {
                return rows.next()
                    ? Optional.of((ObjectNode) json.readTree(rows.getString(1)))
                    : Optional.empty();
            }
        } catch (SQLException e) {
            throw new IOException(e);
        }
    }

    ObjectNode rankings(String period, long since) throws IOException {
        String sql =
            "SELECT * FROM (SELECT c.recipe, c.created_at, c.review_count, c.rating, c.recipe_name, c.id, v.views, ROW_NUMBER() OVER(PARTITION BY c.dish_key ORDER BY v.views DESC, c.recipe_name, c.id) AS position FROM recipe_catalog c JOIN (SELECT recipe_id, SUM(amount) AS views FROM recipe_view_events WHERE viewed_at>=? GROUP BY recipe_id) v ON c.id=v.recipe_id WHERE c.hidden=FALSE) WHERE position=1 ORDER BY views DESC, recipe_name, id LIMIT 20";
        try (var query = connection.prepareStatement(sql)) {
            query.setLong(1, since);
            var result = json.createObjectNode().put("period", period);
            var list = result.putArray("rankings");
            try (var rows = query.executeQuery()) {
                while (rows.next()) list.add(row(rows));
            }
            return result;
        } catch (SQLException e) {
            throw new IOException(e);
        }
    }
}
