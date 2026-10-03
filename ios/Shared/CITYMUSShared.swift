import Foundation

struct PlaybackSnapshot: Codable, Equatable {
    var shareID: String
    var title: String
    var artist: String
    var theme: String
    var themeSlug: String
    var isPlaying: Bool
    var position: Double
    var duration: Double
    var artworkFile: String?
    var updatedAt: Date

    static let placeholder = PlaybackSnapshot(
        shareID: "", title: "CITYMUS", artist: "Music for where you are",
        theme: "CITYMUS", themeSlug: "taipei-dream",
        isPlaying: false, position: 0, duration: 0,
        artworkFile: nil, updatedAt: .distantPast
    )
}

struct RecommendationSnapshot: Codable, Equatable, Identifiable {
    var shareID: String
    var title: String
    var artist: String
    var theme: String
    var artworkFile: String?
    var id: String { shareID }
}

struct CityContextSnapshot: Codable, Equatable {
    var name: String
    var displayName: String
    var themeSlug: String
    var updatedAt: Date

    static let placeholder = CityContextSnapshot(
        name: "Taipei", displayName: "台北",
        themeSlug: "taipei-dream", updatedAt: .distantPast
    )
}

enum CITYMUSShared {
    static let appGroup = "group.com.easylearnfromtw.citymus"
    static let webURL = URL(string: "https://easylearnfromtw.github.io/musictown/")!

    private static let playbackKey = "citymus.playback.v1"
    private static let recommendationsKey = "citymus.recommendations.v1"
    private static let cityKey = "citymus.city.v1"

    static var defaults: UserDefaults { UserDefaults(suiteName: appGroup) ?? .standard }

    static var containerURL: URL {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)
        ?? FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
    }

    static var playback: PlaybackSnapshot {
        get { read(PlaybackSnapshot.self, key: playbackKey) ?? .placeholder }
        set { write(newValue, key: playbackKey) }
    }

    static var recommendations: [RecommendationSnapshot] {
        get { read([RecommendationSnapshot].self, key: recommendationsKey) ?? [] }
        set { write(newValue, key: recommendationsKey) }
    }

    static var city: CityContextSnapshot {
        get { read(CityContextSnapshot.self, key: cityKey) ?? .placeholder }
        set { write(newValue, key: cityKey) }
    }

    static func safeFileComponent(_ value: String) -> String {
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_"))
        return value.unicodeScalars.map { allowed.contains($0) ? String($0) : "-" }.joined()
    }

    @discardableResult
    static func writeDataURL(_ dataURL: String, filename: String) -> String? {
        guard let comma = dataURL.firstIndex(of: ",") else { return nil }
        let encoded = String(dataURL[dataURL.index(after: comma)...])
        guard let data = Data(base64Encoded: encoded, options: .ignoreUnknownCharacters) else { return nil }
        let target = containerURL.appendingPathComponent(filename)
        do { try data.write(to: target, options: .atomic); return filename }
        catch { return nil }
    }

    static func imageData(named filename: String?) -> Data? {
        guard let filename, !filename.isEmpty else { return nil }
        return try? Data(contentsOf: containerURL.appendingPathComponent(filename))
    }

    private static func read<T: Decodable>(_ type: T.Type, key: String) -> T? {
        guard let data = defaults.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }

    private static func write<T: Encodable>(_ value: T, key: String) {
        guard let data = try? JSONEncoder().encode(value) else { return }
        defaults.set(data, forKey: key)
    }
}
