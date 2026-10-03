import AppIntents
import SwiftUI
import UIKit
import WidgetKit

enum WidgetTheme: String, AppEnum {
    case automatic, light, dark
    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Theme")
    static var caseDisplayRepresentations: [Self: DisplayRepresentation] = [
        .automatic:"Auto", .light:"Light", .dark:"Dark"
    ]
}

enum WidgetCity: String, AppEnum {
    case automatic, taipei, tokyo, seoul, hongKong, paris
    static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "City")
    static var caseDisplayRepresentations: [Self: DisplayRepresentation] = [
        .automatic:"Automatic", .taipei:"Taipei", .tokyo:"Tokyo",
        .seoul:"Seoul", .hongKong:"Hong Kong", .paris:"Paris"
    ]
    var name: String {
        switch self {
        case .automatic:return CITYMUSShared.city.name.uppercased()
        case .taipei:return "TAIPEI"; case .tokyo:return "TOKYO"; case .seoul:return "SEOUL"
        case .hongKong:return "HONG KONG"; case .paris:return "PARIS"
        }
    }
    var slug: String {
        switch self {
        case .automatic:return CITYMUSShared.city.themeSlug
        case .taipei:return "taipei-dream"; case .tokyo:return "old-tokyo"; case .seoul:return "electric-seoul"
        case .hongKong:return "bustling-hong-kong"; case .paris:return "champs-elysees"
        }
    }
}

struct NowIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Now Playing"
    @Parameter(title:"Theme", default:.automatic) var theme: WidgetTheme
}
struct PlayerIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "CITYMUS Player"
    @Parameter(title:"Theme", default:.automatic) var theme: WidgetTheme
}
struct ForYouIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "For You"
    @Parameter(title:"Theme", default:.automatic) var theme: WidgetTheme
}
struct RadioIntent: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "City Radio"
    @Parameter(title:"City", default:.automatic) var city: WidgetCity
    @Parameter(title:"Theme", default:.automatic) var theme: WidgetTheme
}

struct NowEntry: TimelineEntry { let date:Date; let configuration:NowIntent; let state:PlaybackSnapshot }
struct PlayerEntry: TimelineEntry { let date:Date; let configuration:PlayerIntent; let state:PlaybackSnapshot }
struct ForYouEntry: TimelineEntry { let date:Date; let configuration:ForYouIntent; let items:[RecommendationSnapshot] }
struct RadioEntry: TimelineEntry { let date:Date; let configuration:RadioIntent }

struct NowProvider: AppIntentTimelineProvider {
    func placeholder(in context:Context)->NowEntry { .init(date:.now, configuration:.init(), state:.placeholder) }
    func snapshot(for c:NowIntent,in context:Context) async->NowEntry { .init(date:.now,configuration:c,state:CITYMUSShared.playback) }
    func timeline(for c:NowIntent,in context:Context) async->Timeline<NowEntry> {
        .init(entries:[.init(date:.now,configuration:c,state:CITYMUSShared.playback)],policy:.after(.now.addingTimeInterval(900)))
    }
}
struct PlayerProvider: AppIntentTimelineProvider {
    func placeholder(in context:Context)->PlayerEntry { .init(date:.now,configuration:.init(),state:.placeholder) }
    func snapshot(for c:PlayerIntent,in context:Context) async->PlayerEntry { .init(date:.now,configuration:c,state:CITYMUSShared.playback) }
    func timeline(for c:PlayerIntent,in context:Context) async->Timeline<PlayerEntry> {
        .init(entries:[.init(date:.now,configuration:c,state:CITYMUSShared.playback)],policy:.after(.now.addingTimeInterval(900)))
    }
}
struct ForYouProvider: AppIntentTimelineProvider {
    func placeholder(in context:Context)->ForYouEntry {
        .init(date:.now,configuration:.init(),items:[
            .init(shareID:"one",title:"After Rain",artist:"CITYMUS",theme:"Taipei",artworkFile:nil),
            .init(shareID:"two",title:"Moonlit Haze",artist:"CITYMUS",theme:"Night",artworkFile:nil),
            .init(shareID:"three",title:"Old Room",artist:"CITYMUS",theme:"Editorial",artworkFile:nil)
        ])
    }
    func snapshot(for c:ForYouIntent,in context:Context) async->ForYouEntry { .init(date:.now,configuration:c,items:CITYMUSShared.recommendations) }
    func timeline(for c:ForYouIntent,in context:Context) async->Timeline<ForYouEntry> {
        .init(entries:[.init(date:.now,configuration:c,items:CITYMUSShared.recommendations)],policy:.after(.now.addingTimeInterval(1800)))
    }
}
struct RadioProvider: AppIntentTimelineProvider {
    func placeholder(in context:Context)->RadioEntry { .init(date:.now,configuration:.init()) }
    func snapshot(for c:RadioIntent,in context:Context) async->RadioEntry { .init(date:.now,configuration:c) }
    func timeline(for c:RadioIntent,in context:Context) async->Timeline<RadioEntry> {
        let now=Date()
        let e=stride(from:0,through:60,by:15).map{ RadioEntry(date:now.addingTimeInterval(Double($0*60)),configuration:c) }
        return .init(entries:e,policy:.after(now.addingTimeInterval(3600)))
    }
}

private struct Palette {
    let bg:Color, fg:Color, sub:Color, tile:Color
    static func make(_ t:WidgetTheme,_ sys:ColorScheme)->Palette {
        let dark = t == .dark || (t == .automatic && sys == .dark)
        return dark
        ? .init(bg:Color(red:0.075,green:0.082,blue:0.105),fg:.white,sub:.white.opacity(0.62),tile:.white.opacity(0.09))
        : .init(bg:Color(red:0.965,green:0.957,blue:00.925),fg:Color(red:0.15,green:0.17,blue:0.24),sub:Color(red:0.36,green:0.37,blue:0.42),tile:.white.opacity(0.72))
    }
}
private struct Art:View {
    let file:String?; let radius:CGFloat
    var body:some View {
        Group {
            if let d=CITYMUSShared.imageData(named:file),let u=UIImage(data:d) {
                Image(uiImage:u).resizable().scaledToFill()
            } else {
                ZStack {
                    LinearGradient(colors:[Color(red:0.56,green:0.58,blue:0.70),Color(red:0.89,green:0.86,blue:0.78)],startPoint:.topLeading,endPoint:.bottomTrailing)
                    Text("C").font(.system(size:34,weight:.black,design:.rounded)).foregroundStyle(.white.opacity(0.92))
                }
            }
        }.clipShape(RoundedRectangle(cornerRadius:radius,style:.continuous))
    }
}

struct NowView:View {
    let entry:NowEntry; @Environment(\.colorScheme) var cs
    var body:some View {
        let p=Palette.make(entry.configuration.theme,cs)
        VStack(alignment:.leading,spacing:8){
            Art(file:entry.state.artworkFile,radius:16).aspectRatio(1.55,contentMode:.fill)
            Text(entry.state.title).font(.system(size:14,weight:.bold)).foregroundStyle(p.fg).lineLimit(1)
            HStack(spacing:5){
                Image(systemName:entry.state.isPlaying ? "waveform":"pause.fill").font(.caption2)
                Text(entry.state.artist.isEmpty ? "CITYMUS":entry.state.artist).lineLimit(1)
            }.font(.caption).foregroundStyle(p.sub)
        }.padding(12).containerBackground(for:.widget){p.bg}.widgetURL(URL(string:"citymus://player"))
    }
}
struct PlayerView:View {
    let entry:PlayerEntry; @Environment(\.colorScheme) var cs
    var body:some View {
        let p=Palette.make(entry.configuration.theme,cs)
        HStack(spacing:14){
            Link(destination:URL(string:"citymus://player")!){ Art(file:entry.state.artworkFile,radius:18).frame(width:112,height:112) }
            VStack(alignment:.leading,spacing:5){
                Text("CITYMUS").font(.system(size:10,weight:.black)).tracking(1.5).foregroundStyle(p.sub)
                Text(entry.state.title).font(.system(size:18,weight:.bold)).foregroundStyle(p.fg).lineLimit(2)
                Text(entry.state.artist.isEmpty ? entry.state.theme:entry.state.artist).font(.subheadline).foregroundStyle(p.sub).lineLimit(1)
                Spacer(minLength:4)
                HStack(spacing:18){
                    Link(destination:URL(string:"citymus://action?name=prev")!){Image(systemName:"backward.fill")}
                    Link(destination:URL(string:"citymus://action?name=playpause")!){Image(systemName:entry.state.isPlaying ? "pause.fill":"play.fill").font(.title3)}
                    Link(destination:URL(string:"citymus://action?name=next")!){Image(systemName:"forward.fill")}
                }.foregroundStyle(p.fg)
            }
        }.padding(14).containerBackground(for:.widget){p.bg}
    }
}
struct ForYouView:View {
    let entry:ForYouEntry; @Environment(\.colorScheme) var cs
    var body:some View {
        let p=Palette.make(entry.configuration.theme,cs)
        let rows = entry.items.isEmpty ? [RecommendationSnapshot(shareID:"",title:"打開 CITYMUS 取得今日推薦",artist:"CITYMUS",theme:"",artworkFile:nil)] : Array(entry.items.prefix(3))
        VStack(alignment:.leading,spacing:8){
            HStack{Text("FOR YOU").font(.system(size:11,weight:.black)).tracking(1.3);Spacer();Text("CITYMUS").font(.caption2.weight(.bold)).foregroundStyle(p.sub)}.foregroundStyle(p.fg)
            ForEach(rows){ item in
                Link(destination:URL(string:item.shareID.isEmpty ? "citymus://home":"citymus://track/\(item.shareID)")!){
                    HStack(spacing:9){
                        Art(file:item.artworkFile,radius:7).frame(width:34,height:34)
                        VStack(alignment:.leading,spacing:1){
                            Text(item.title).font(.system(size:13,weight:.semibold)).foregroundStyle(p.fg).lineLimit(1)
                            Text(item.artist.isEmpty ? item.theme:item.artist).font(.caption2).foregroundStyle(p.sub).lineLimit(1)
                        };Spacer(minLength:0)
                    }
                }
            }
        }.padding(14).containerBackground(for:.widget){p.bg}
    }
}
struct RadioView:View {
    let entry:RadioEntry
    @Environment(\.widgetFamily) var family
    @Environment(\.colorScheme) var cs
    var line:String {
        switch Calendar.current.component(.hour,from:entry.date) {
        case 5..<10:return "Morning commute"; case 10..<17:return "Afternoon city radio"
        case 17..<22:return "After work, stay a little"; default:return "夜裡還沒睡？"
        }
    }
    var body:some View {
        let p=Palette.make(entry.configuration.theme,cs), city=entry.configuration.city
        VStack(alignment:.leading,spacing:6){
            HStack{Text(city.name).font(.system(size:11,weight:.black)).tracking(1.1);Spacer();Text(entry.date,style:.time).font(.caption2.monospacedDigit())}.foregroundStyle(p.sub)
            Spacer(minLength:2)
            Text(line).font(.system(size:family == .systemSmall ? 17:20,weight:.bold)).foregroundStyle(p.fg).lineLimit(2)
            Text("CITYMUS RADIO").font(.caption.weight(.bold)).foregroundStyle(p.sub)
            Spacer(minLength:2)
            Link(destination:URL(string:"citymus://radio?theme=\(city.slug)")!){
                HStack(spacing:7){Image(systemName:"play.fill");Text("PLAY").font(.caption.weight(.black))}
                    .foregroundStyle(p.fg).padding(.horizontal,11).padding(.vertical,7).background(p.tile,in:Capsule())
            }
        }.padding(14).containerBackground(for:.widget){p.bg}
    }
}

struct NowWidget:Widget {
    var body:some WidgetConfiguration {
        AppIntentConfiguration(kind:"com.easylearnfromtw.citymus.now",intent:NowIntent.self,provider:NowProvider()){NowView(entry:$0)}
            .configurationDisplayName("CITYMUS Now Playing").description("目前歌曲、封面與播放狀態。").supportedFamilies([.systemSmall])
    }
}
struct PlayerWidget:Widget {
    var body:some WidgetConfiguration {
        AppIntentConfiguration(kind:"com.easylearnfromtw.citymus.player",intent:PlayerIntent.self,provider:PlayerProvider()){PlayerView(entry:$0)}
            .configurationDisplayName("CITYMUS Player").description("封面、歌曲與快速控制入口。").supportedFamilies([.systemMedium])
    }
}
struct ForYouWidget:Widget {
    var body:some WidgetConfiguration {
        AppIntentConfiguration(kind:"com.easylearnfromtw.citymus.foryou",intent:ForYouIntent.self,provider:ForYouProvider()){ForYouView(entry:$0)}
            .configurationDisplayName("CITYMUS For You").description("今天為你挑出的三首歌。").supportedFamilies([.systemMedium])
    }
}
struct RadioWidget:Widget {
    var body:some WidgetConfiguration {
        AppIntentConfiguration(kind:"com.easylearnfromtw.citymus.radio",intent:RadioIntent.self,provider:RadioProvider()){RadioView(entry:$0)}
            .configurationDisplayName("CITYMUS City Radio").description("依城市與時段打開 CITYMUS Radio。").supportedFamilies([.systemSmall,.systemMedium])
    }
}
@main struct CITYMUSWidgetsBundle:WidgetBundle {
    var body:some Widget { NowWidget(); PlayerWidget(); ForYouWidget(); RadioWidget() }
}
