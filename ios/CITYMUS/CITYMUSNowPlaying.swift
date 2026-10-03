import Foundation
import MediaPlayer
import UIKit

final class CITYMUSNowPlaying {
    static let shared = CITYMUSNowPlaying()
    private init() {}

    func update(_ snapshot: PlaybackSnapshot) {
        guard !snapshot.shareID.isEmpty else { return }

        var info: [String: Any] = [
            MPMediaItemPropertyTitle: snapshot.title,
            MPMediaItemPropertyArtist: snapshot.artist,
            MPMediaItemPropertyAlbumTitle: snapshot.theme,
            MPNowPlayingInfoPropertyElapsedPlaybackTime: max(0, snapshot.position),
            MPNowPlayingInfoPropertyPlaybackRate: snapshot.isPlaying ? 1.0 : 0.0
        ]

        if snapshot.duration > 0 {
            info[MPMediaItemPropertyPlaybackDuration] = snapshot.duration
        }

        if let data = CITYMUSShared.imageData(named: snapshot.artworkFile),
           let image = UIImage(data: data) {
            let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
            info[MPMediaItemPropertyArtwork] = artwork
        }

        MPNowPlayingInfoCenter.default().nowPlayingInfo = info
        MPNowPlayingInfoCenter.default().playbackState = snapshot.isPlaying ? .playing : .paused
    }
}
