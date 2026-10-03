#!/usr/bin/env python3
"""Literature themes · 18 works × 25 public-domain / open-licence recordings.

Every recording below was checked on the Internet Archive (file listing + item
licence) on 2026-10-03. Composers all died more than 50 years ago (the newest is
Josef Suk, 1935). Writes src/literature.json, which build.py inlines.
"""
import json, pathlib, urllib.parse

ROOT = pathlib.Path(__file__).resolve().parents[1]
IA = "https://archive.org/download/"

SRC = {  # item → licence, performer, details page
    "CH":  ("musopen-chopin", "CC0 1.0 Universal", "Musopen"),
    "MC":  ("MusopenCollectionAsFlac", "Public Domain Mark 1.0", None),
    "WTC": ("bach-well-tempered-clavier-book-1", "Public Domain Mark 1.0", "Kimiko Ishizaka"),
    "AOF": ("pandacd-715-js-bach-the-art-of-the-fugue-kunst-der-fuge-bwv-1080", "CC0 1.0 Universal", "Kimiko Ishizaka"),
    "LIB": ("Musopen-Libre", "CC BY-SA 3.0", "Musopen"),
    "SAT1": ("ThreeGnossiennesErikSatie", "CC BY 3.0", "Rafi Simcha"),
    "SAT2": ("satie-gnossienne-gymnopedie", "CC BY 4.0", "Gregory Tait"),
    "KM":  ("gymnopedie-no-1-by-kevin-macleod", "CC BY 4.0", "Kevin MacLeod"),
    "MOON": ("MoonlightSonata_845", "Public Domain Mark 1.0", "Paul Pitman"),
}
COMPOSER = {
    "chopin": ("Frédéric Chopin", "蕭邦", 1849), "bach": ("Johann Sebastian Bach", "巴哈", 1750),
    "schubert": ("Franz Schubert", "舒伯特", 1828), "beethoven": ("Ludwig van Beethoven", "貝多芬", 1827),
    "brahms": ("Johannes Brahms", "布拉姆斯", 1897), "mozart": ("Wolfgang Amadeus Mozart", "莫札特", 1791),
    "haydn": ("Joseph Haydn", "海頓", 1809), "mendelssohn": ("Felix Mendelssohn", "孟德爾頌", 1847),
    "tchaikovsky": ("Pyotr Ilyich Tchaikovsky", "柴可夫斯基", 1893), "dvorak": ("Antonín Dvořák", "德弗札克", 1904),
    "borodin": ("Alexander Borodin", "鮑羅定", 1887), "grieg": ("Edvard Grieg", "葛利格", 1907),
    "rimsky": ("Nikolai Rimsky-Korsakov", "林姆斯基-高沙可夫", 1908), "smetana": ("Bedřich Smetana", "史麥塔納", 1884),
    "suk": ("Josef Suk", "蘇克", 1935), "satie": ("Erik Satie", "薩提", 1925),
}
ORCH, QUART, PIANO = "Czech National Symphony Orchestra · Musopen", "Musopen String Quartet", "Musopen"

R = {}  # key → recording
def rec(key, src, path, title, comp, performer=None):
    item, lic, perf = SRC[src]
    R[key] = dict(item=item, path=path, title=title, comp=comp, license=lic, performer=performer or perf or PIANO)

# ---------- Chopin (musopen-chopin, CC0) ----------
CHF = {
 "C1": ("Allegro de Concert Op. 46 in A Major.mp3", "Allegro de concert in A major, Op. 46"),
 "C2": ("Ballade no. 1 - Op. 23.mp3", "Ballade No. 1 in G minor, Op. 23"),
 "C3": ("Ballade no. 2 - Op. 38.mp3", "Ballade No. 2 in F major, Op. 38"),
 "C4": ("Ballade no. 3 - Op. 47.mp3", "Ballade No. 3 in A-flat major, Op. 47"),
 "C5": ("Ballade no. 4 - Op. 52.mp3", "Ballade No. 4 in F minor, Op. 52"),
 "C7": ("Fantasie Impromptu Op. 66.mp3", "Fantaisie-Impromptu in C-sharp minor, Op. 66"),
 "C8": ("Fantasy Op. 49 in F minor.mp3", "Fantaisie in F minor, Op. 49"),
 "C9": ("Fugue in A minor B. 144.mp3", "Fugue in A minor, B. 144"),
 "C10": ("Grande Valse Brilliante Op.18 In E flat major.mp3", "Grande Valse brillante in E-flat major, Op. 18"),
 "C11": ("Impromptu no. 1 - Op. 29.mp3", "Impromptu No. 1 in A-flat major, Op. 29"),
 "C12": ("Impromptu no. 2 - Op. 36.mp3", "Impromptu No. 2 in F-sharp major, Op. 36"),
 "C13": ("Impromptu no. 3 - Op. 51.mp3", "Impromptu No. 3 in G-flat major, Op. 51"),
 "C14": ("Mazurka Op. 17 no. 3 in A flat major.mp3", "Mazurka in A-flat major, Op. 17 No. 3"),
 "C15": ("Mazurka Op. 17 no. 4 in A minor.mp3", "Mazurka in A minor, Op. 17 No. 4"),
 "C16": ("Mazurka Op. 24 no. 2 in C major.mp3", "Mazurka in C major, Op. 24 No. 2"),
 "C17": ("Mazurka Op. 24 no. 3 in A flat major.mp3", "Mazurka in A-flat major, Op. 24 No. 3"),
 "C18": ("Mazurka Op. 24 no. 4 in B flat minor.mp3", "Mazurka in B-flat minor, Op. 24 No. 4"),
 "C19": ("Mazurka Op. 50 no. 1 in G major.mp3", "Mazurka in G major, Op. 50 No. 1"),
 "C20": ("Mazurka Op. 50 no. 2 in A flat major.mp3", "Mazurka in A-flat major, Op. 50 No. 2"),
 "C21": ("Mazurka Op. 50 no. 3 in C sharp minor.mp3", "Mazurka in C-sharp minor, Op. 50 No. 3"),
 "C22": ("Mazurka Op. 56 no. 1 in B major.mp3", "Mazurka in B major, Op. 56 No. 1"),
 "C23": ("Mazurka Op. 56 no. 2 in C major.mp3", "Mazurka in C major, Op. 56 No. 2"),
 "C24": ("Mazurka Op. 56 no. 3 in C minor.mp3", "Mazurka in C minor, Op. 56 No. 3"),
 "C25": ("Mazurka Op. 59 no. 1 in A minor.mp3", "Mazurka in A minor, Op. 59 No. 1"),
 "C26": ("Mazurka Op. 59 no. 2 in A flat major.mp3", "Mazurka in A-flat major, Op. 59 No. 2"),
 "C27": ("Mazurka Op. 59 no. 3 in F sharp minor.mp3", "Mazurka in F-sharp minor, Op. 59 No. 3"),
 "C28": ("Mazurka Op. 7 no. 3 in F minor.mp3", "Mazurka in F minor, Op. 7 No. 3"),
 "C29": ("Mazurka Op. 7 no. 4 in A flat major.mp3", "Mazurka in A-flat major, Op. 7 No. 4"),
 "C30": ("Nocturne B. 108 in C minor.mp3", "Nocturne in C minor, B. 108"),
 "C31": ("Nocturne B. 49 in C sharp minor 'Lento con gran espressione' (1).mp3", "Nocturne in C-sharp minor, B. 49 “Lento con gran espressione”"),
 "C32": ("Nocturne B. 49 in C sharp minor 'Lento con gran espressione' (2).mp3", "Nocturne in C-sharp minor, B. 49 (second reading)"),
 "C33": ("Nocturne Op. 15 no. 1 In F major.mp3", "Nocturne in F major, Op. 15 No. 1"),
 "C34": ("Nocturne Op. 27 no. 1 in C sharp minor.mp3", "Nocturne in C-sharp minor, Op. 27 No. 1"),
 "C35": ("Nocturne Op. 32 no. 1 in B major.mp3", "Nocturne in B major, Op. 32 No. 1"),
 "C36": ("Nocturne Op. 32 no. 2 in A flat major.mp3", "Nocturne in A-flat major, Op. 32 No. 2"),
 "C37": ("Nocturne Op. 48 no. 1 in C minor.mp3", "Nocturne in C minor, Op. 48 No. 1"),
 "C38": ("Nocturne Op. 48 no. 2 in F sharp minor.mp3", "Nocturne in F-sharp minor, Op. 48 No. 2"),
 "C39": ("Nocturne Op. 55 no. 1 in F minor.mp3", "Nocturne in F minor, Op. 55 No. 1"),
 "C40": ("Nocturne Op. 55 no. 2 in E flat major.mp3", "Nocturne in E-flat major, Op. 55 No. 2"),
 "C41": ("Nocturne Op. 62 no. 2 in E major.mp3", "Nocturne in E major, Op. 62 No. 2"),
 "C42": ("Nocturne Op. 9 no. 2 in E flat major.mp3", "Nocturne in E-flat major, Op. 9 No. 2"),
 "CP6": ("Prelude Op. 28 no. 6.mp3", "Prélude in B minor, Op. 28 No. 6"),
}
for k, (f, t) in CHF.items(): rec(k, "CH", f, t, "chopin")

# ---------- Musopen collection (PD Mark): per-movement MP3 derivatives ----------
def mc(key, folder, file, title, comp, perf):
    rec(key, "MC", f"{folder}/{file}", title, comp, perf)
GV = ["Aria", "Variation1", "Variation2", "Variation3.CanonOnTheUnison", "Variation4", "Variation5", "Variation6.CanonOnTheSecond", "Variation7", "Variation8",
      "Variation9.CanonOnTheThird", "Variation10.Fughetta", "Variation11", "Variation12.CanonOnTheFourth", "Variation13", "Variation14", "Variation15.CanonOnTheFifth",
      "Variation16.Overture", "Variation17", "Variation18.CanonOnTheSixth", "Variation19", "Variation20", "Variation21.CanonOnTheSeventh", "Variation22", "Variation23",
      "Variation24.CanonOnTheOctave", "Variation25", "Variation26", "Variation27.CanonOnTheNinth", "Variation28", "Variation29", "Variation30.Quodlibet", "AriaDaCapo"]
def gtitle(i):
    if i == 0: return "Goldberg Variations, BWV 988 · Aria"
    if i == 31: return "Goldberg Variations, BWV 988 · Aria da capo"
    n = GV[i].replace("Variation", "Variation ").split(".")
    extra = {"CanonOnTheUnison": "Canon at the Unison", "CanonOnTheSecond": "Canon at the Second", "CanonOnTheThird": "Canon at the Third", "Fughetta": "Fughetta",
             "CanonOnTheFourth": "Canon at the Fourth", "CanonOnTheFifth": "Canon at the Fifth", "Overture": "Ouverture", "CanonOnTheSixth": "Canon at the Sixth",
             "CanonOnTheSeventh": "Canon at the Seventh", "CanonOnTheOctave": "Canon at the Octave", "CanonOnTheNinth": "Canon at the Ninth", "Quodlibet": "Quodlibet"}
    return f"Goldberg Variations, BWV 988 · {n[0]}" + (f" ({extra[n[1]]})" if len(n) > 1 else "")
for i, v in enumerate(GV):
    mc(f"G{i}", "Bach_GoldbergVariations", f"JohannSebastianBach-{i+1:02d}-GoldbergVariationsBwv.988-{v}.mp3", gtitle(i), "bach", "Kimiko Ishizaka")

def mvts(prefix, folder, stem, names, title, comp, perf, roman=True):
    for i, (fname, label) in enumerate(names, 1):
        r = ["I", "II", "III", "IV", "V"][i - 1]
        mc(f"{prefix}-{r}", folder, f"{stem}-{i:02d}-{fname}.mp3", f"{title} · {r}. {label}", comp, perf)

mvts("D784", "Schubert_SonataInAMinorD.784", "FranzSchubert-SonataInAMinorD.784", [("AllegroGiusto", "Allegro giusto"), ("Andante", "Andante"), ("AllegroVivace", "Allegro vivace")], "Piano Sonata in A minor, D. 784", "schubert", PIANO)
mvts("D664", "Schubert_SonataInAMajorD.664", "FranzSchubert-SonataInAMajorD.664", [("AllegroModerato", "Allegro moderato"), ("Andante", "Andante"), ("Allegro", "Allegro")], "Piano Sonata in A major, D. 664", "schubert", PIANO)
mvts("D845", "Schubert_SonataInAMinorD.845", "FranzSchubert-SonataInAMinorD.845", [("Moderato", "Moderato"), ("AndantePocoMosso", "Andante poco mosso"), ("Scherzo.AllegroVivace-Trio.UnPocoPiuLento", "Scherzo. Allegro vivace"), ("Rondo.AllegroVivace", "Rondo. Allegro vivace")], "Piano Sonata in A minor, D. 845", "schubert", PIANO)
mvts("D959", "Schubert_SonataInAMinorD.959", "FranzSchubert-SonataInAMinorD.959", [("Allegro", "Allegro"), ("Andantino", "Andantino"), ("Scherzo.AllegroVivace", "Scherzo. Allegro vivace"), ("Rondo.Allegretto", "Rondo. Allegretto")], "Piano Sonata in A major, D. 959", "schubert", PIANO)
mvts("D958", "Schubert_SonataInCMinorD.958", "FranzSchubert-SonataInCMinorD.958", [("Allegro", "Allegro"), ("Adagio", "Adagio"), ("MenuettoAllegro", "Menuetto. Allegro"), ("Allegro", "Allegro")], "Piano Sonata in C minor, D. 958", "schubert", PIANO)
mvts("D850", "Schubert_SonataInDMajorD.850", "FranzSchubert-SonataInDMajorD.850", [("AllegroVivace", "Allegro vivace"), ("ConMoto", "Con moto"), ("Scherzo.AllegroVivace", "Scherzo. Allegro vivace"), ("Rondo.AllegroModerato", "Rondo. Allegro moderato")], "Piano Sonata in D major, D. 850", "schubert", PIANO)
mvts("D568", "Schubert_SonataInEFlatMajorD.568", "FranzSchubert-SonataInEFlatMajorD.568", [("AllegroModerato", "Allegro moderato"), ("AndanteMolto", "Andante molto"), ("MenuettoAllegretto", "Menuetto. Allegretto"), ("AllegroModerato", "Allegro moderato")], "Piano Sonata in E-flat major, D. 568", "schubert", PIANO)
mvts("BQ2", "Borodin_StringQuartetNo.2inDMajor", "AlexanderBorodin-StringQuartetNo.2InDMajor", [("AllegroModerato", "Allegro moderato"), ("ScherzoAllegro", "Scherzo. Allegro"), ("NocturneAndante", "Notturno. Andante"), ("FinaleAndante-Vivace", "Finale. Andante – Vivace")], "String Quartet No. 2 in D major", "borodin", QUART)
mvts("BQ1", "Borodin_StringQuartetNo.1inAMajor", "AlexanderBorodin-StringQuartetNo.1InAMajor", [("Moderato-Allegro", "Moderato – Allegro"), ("AndanteConMoto", "Andante con moto"), ("ScherzoPrestissimo", "Scherzo. Prestissimo"), ("Andante-AllegroRisoluto", "Andante – Allegro risoluto")], "String Quartet No. 1 in A major", "borodin", QUART)
mvts("TCH6", "Tchaikovsky_SymphonyPathetique", "PyotrIlyichTchaikovsky-SymphonyNo.6InBMinorOp.74pathtique", [("AdagioAllegroNonTroppo", "Adagio – Allegro non troppo"), ("AllegroConGracia", "Allegro con grazia"), ("AllegroMoltoVivace", "Allegro molto vivace"), ("FinaleAdagioLamentoso", "Finale. Adagio lamentoso")], "Symphony No. 6 in B minor “Pathétique”, Op. 74", "tchaikovsky", ORCH)
mvts("SCOT", "Mendelssohn_ScottishSymphony", "FelixMendelssohn-SymphonyNo.3InAMinorscottishOp.56", [("AndanteConMoto", "Andante con moto – Allegro"), ("VivaceNonTroppo", "Vivace non troppo"), ("Adagio", "Adagio"), ("AllegroVivacissimo", "Allegro vivacissimo")], "Symphony No. 3 in A minor “Scottish”, Op. 56", "mendelssohn", ORCH)
mvts("ITAL", "Mendelssohn_ItalianSymphony", "FelixMendelssohn-SymphonyNo.4InAMajorOp.90italian", [("AllegroVivace", "Allegro vivace"), ("AndanteConMoto", "Andante con moto"), ("ConMotoModerato", "Con moto moderato"), ("Saltarellopresto", "Saltarello. Presto")], "Symphony No. 4 in A major “Italian”, Op. 90", "mendelssohn", ORCH)
mvts("MQ6", "Mendelssohn_StringQuartetNo.6inFMinorOp.80", "FelixMendelssohn-StringQuartetNo.6InFMinorOp.80", [("AllegroVivaceAssai", "Allegro vivace assai"), ("AllegroAssai", "Allegro assai"), ("Adagio", "Adagio"), ("Fuga", "Finale. Allegro molto")], "String Quartet No. 6 in F minor, Op. 80", "mendelssohn", QUART)
mvts("M40", "Mozart_SymphonyNo.40inGMinor", "WolfgangAmadeusMozart-SymphonyNo.40InGMinorK.550", [("MoltoAllegro", "Molto allegro"), ("Andante", "Andante"), ("MenuettoAllegretto", "Menuetto. Allegretto"), ("AllegroAssai", "Allegro assai")], "Symphony No. 40 in G minor, K. 550", "mozart", ORCH)
mvts("K421", "Mozart_StringQuartetNo.15inDMinorK421", "WolfgangAmadeusMozart-StringQuartetNo.15InDMinorK421", [("AllegroModerato", "Allegro moderato"), ("Andante", "Andante"), ("Minuetto", "Menuetto"), ("AllegroMaNonTroppo", "Allegretto ma non troppo")], "String Quartet No. 15 in D minor, K. 421", "mozart", QUART)
mvts("K465", "Mozart_StringQuartetNo.19inCMajorK465", "WolfgangAmadeusMozart-StringQuartetNo.19InCK465Dissonance", [("AdagioAllegro", "Adagio – Allegro"), ("AndanteCantabile", "Andante cantabile"), ("MinuettoAllegretto", "Menuetto. Allegretto"), ("AllegroVolto", "Allegro molto")], "String Quartet No. 19 in C major “Dissonance”, K. 465", "mozart", QUART)
mvts("ERO", "Beethoven_SymphonyNo.3Eroica", "LudwigVanBeethoven-SymphonyNo.3InEFlatMajorEroicaOp.55", [("AllegroConBrio", "Allegro con brio"), ("MarciaFunebreAdagioAssai", "Marcia funebre. Adagio assai"), ("ScherzoAllegroVivace", "Scherzo. Allegro vivace"), ("FinaleAllegroMolto", "Finale. Allegro molto")], "Symphony No. 3 in E-flat major “Eroica”, Op. 55", "beethoven", ORCH)
mvts("BQ6", "Beethoven_StringQuartetNo.6inBFlatMajorOp.18", "LudwigVanBeethoven-StringQuartetNo.6InBFlatMajorOp.18No.6", [("AllegroConBrio", "Allegro con brio"), ("AdagioMaNonTroppo", "Adagio ma non troppo"), ("ScherzoAllegro", "Scherzo. Allegro"), ("adagioLaMalinconia", "La Malinconia. Adagio – Allegretto")], "String Quartet No. 6 in B-flat major, Op. 18 No. 6", "beethoven", QUART)
mvts("BR1", "Brahms_SymphonyNo.1inCMinor", "JohannesBrahms-SymphonyNo.1InCMinorOp.68", [("UnPocoSostenuto-Allegro", "Un poco sostenuto – Allegro"), ("AndanteSostenuto", "Andante sostenuto"), ("UnPocoAllegrettoEGrazioso", "Un poco allegretto e grazioso"), ("Adagio-PiAndante-AllegroNonTroppoMaConBrio", "Adagio – Più andante – Allegro non troppo, ma con brio")], "Symphony No. 1 in C minor, Op. 68", "brahms", ORCH)
mvts("BR3", "Brahms_SymphonyNo.3inFMajor", "JohannesBrahms-SymphonyNo.3InFMajorOp.90", [("AllegroConBrio", "Allegro con brio"), ("Andante", "Andante"), ("PocoAllegretto", "Poco allegretto"), ("Allegro", "Allegro")], "Symphony No. 3 in F major, Op. 90", "brahms", ORCH)
mvts("BR4", "Brahms_SymphonyNo.4inEMinor", "JohannesBrahms-SymphonyNo.4InEMinorOp.98", [("AllegroNonTroppo", "Allegro non troppo"), ("AndanteModerato", "Andante moderato"), ("AllegroGiocoso", "Allegro giocoso"), ("AllegroEnergicoEPassionato", "Allegro energico e passionato")], "Symphony No. 4 in E minor, Op. 98", "brahms", ORCH)
mvts("LARK", "Haydn_StringQuartetInDMajorOp.64", "JosephHaydn-StringQuartetInDOp.645H363Lark", [("AllegroModerato", "Allegro moderato"), ("AdagioCantabile", "Adagio cantabile"), ("MenuettoAllegretto", "Menuetto. Allegretto"), ("FinaleVivace", "Finale. Vivace")], "String Quartet in D major “The Lark”, Op. 64 No. 5", "haydn", QUART)
mvts("DQ12", "Dvorak_StringQuartetNo.12inFMajorOp.96", "AntonnDvorak-StringQuartetNo.12InFMajorOp.96American", [("AllegroMaNonTroppo", "Allegro ma non troppo"), ("Lento", "Lento"), ("MoltoVivace", "Molto vivace"), ("Finale-VivaceMaNonTroppo", "Finale. Vivace ma non troppo")], "String Quartet No. 12 in F major “American”, Op. 96", "dvorak", QUART)
mvts("DQ10", "Dvorak_StringQuartetNo.10inEFlatOp.51", "AntonnDvorak-StringQuartetNo.10InEFlatOp.51", [("AllegroMaNonTroppo", "Allegro ma non troppo"), ("Dumka", "Dumka. Andante con moto"), ("Romanza", "Romanza. Andante"), ("FinaleAllegroAssai", "Finale. Allegro assai")], "String Quartet No. 10 in E-flat major, Op. 51", "dvorak", QUART)
# Brahms 2: four movements, the third in two takes
for key, fname, label in [("BR2-I", "01-AllegroNonTroppo", "I. Allegro non troppo"), ("BR2-II", "02-AdagioNonToppo", "II. Adagio non troppo"), ("BR2-III", "03-AllegrettoGraziosotake1", "III. Allegretto grazioso"), ("BR2-IIIb", "03-AllegrettoGraziosotake2", "III. Allegretto grazioso (second take)"), ("BR2-IV", "04-AllegroConSpirito", "IV. Allegro con spirito")]:
    mc(key, "Brahms_SymphonyNo.2inDMajor", f"JohannesBrahms-SymphonyNo.2InDMajorOp.73-{fname}.mp3", f"Symphony No. 2 in D major, Op. 73 · {label}", "brahms", ORCH)
for key, fname, label in [("PG-1", "01-Morning", "Morning Mood"), ("PG-2", "02-AasesDeath", "The Death of Åse"), ("PG-3", "03-AnitrasDream", "Anitra’s Dance"), ("PG-4", "04-InTheHallOfTheMountainKing", "In the Hall of the Mountain King")]:
    mc(key, "Greig_PeerGynt", f"EdvardGrieg-PeerGyntSuiteNo.1Op.46-{fname}.mp3", f"Peer Gynt Suite No. 1, Op. 46 · {label}", "grieg", ORCH)
mc("EGM", "Beethoven_EgmontOvertureOp.84", "LudwigVanBeethoven-EgmontOvertureOp.84.mp3", "Egmont Overture, Op. 84", "beethoven", ORCH)
mc("COR", "Beethoven_CoriolanOverture", "LudwigVanBeethoven-CoriolanOverture.mp3", "Coriolan Overture, Op. 62", "beethoven", ORCH)
mc("TRAG", "Brahms_TragicOverture", "JohannesBrahms-TragicOverture.mp3", "Tragic Overture, Op. 81", "brahms", ORCH)
mc("HEB", "Mendelssohn_Hebrides", "FelixMendelssohn-HebridesOvertureFingalsCave.mp3", "The Hebrides “Fingal’s Cave”, Op. 26", "mendelssohn", ORCH)
mc("FLUTE", "Mozart_MagicFluteOverture", "WolfgangAmadeusMozart-MagicFluteOverture.mp3", "The Magic Flute, K. 620 · Overture", "mozart", ORCH)
mc("FIG", "Mozart_MarriageOfFigaro", "WolfgangAmadeusMozart-MarriageOfFigaro.mp3", "The Marriage of Figaro, K. 492 · Overture", "mozart", ORCH)
mc("RIM", "Rimsky-Korsakov_RussianOverture", "NikolaiRimsky-korsakov-RussianEasterFestivalOvertureOp.36.mp3", "Russian Easter Festival Overture, Op. 36", "rimsky", ORCH)
mc("VLT", "Smetana_Vltava", "BedichSmetana-MVlast-Vltava.mp3", "Má vlast · Vltava (The Moldau)", "smetana", ORCH)
mc("SUK", "Suk_Meditation", "JosefSuk-Meditation.mp3", "Meditation on the Old Czech Chorale “St Wenceslas”, Op. 35a", "suk", ORCH)
mc("STEP", "Borodin_InTheSteppesOfCentralAsia", "AlexanderBorodin-InTheSteppesOfCentralAsia.mp3", "In the Steppes of Central Asia", "borodin", ORCH)

# ---------- Kimiko Ishizaka · Well-Tempered Clavier I (PD Mark) & Art of Fugue (CC0) ----------
WTC_KEYS = ["C major", "C minor", "C-sharp major", "C-sharp minor", "D major", "D minor", "E-flat major", ("E-flat minor", "D-sharp minor"), "E major", "E minor", "F major", "F minor", "F-sharp major", "F-sharp minor"]
for n in range(1, 15):
    k = WTC_KEYS[n - 1]; kp, kf = (k if isinstance(k, tuple) else (k, k)); bwv = 845 + n
    for kind, key, pos in (("Prelude", kp, 2 * n - 1), ("Fugue", kf, 2 * n)):
        rec(f"WTC-{kind[0]}{n}", "WTC", f"Kimiko Ishizaka - Bach- Well-Tempered Clavier, Book 1 - {pos:02d} {kind} No. {n} in {key}, BWV {bwv}.mp3", f"The Well-Tempered Clavier I · {kind} No. {n} in {key}, BWV {bwv}", "bach")
AOF = ["Contrapunctus 1", "Contrapunctus 2", "Contrapunctus 3", "Contrapunctus 4", "Contrapunctus 5", "Contrapunctus 6 a 4 in Stylo Francese", "Contrapunctus 7 a 4 Per Augmentationem", "Contrapunctus 8 a 3",
       "Contrapunctus 9 a 4 Alla Duodecima", "Contrapunctus 10 a 4 Alla Decima", "Contrapunctus 11 a 4", "Contrapunctus Inversus 12 A4 - Forma Inversa", "Contrapunctus Inversus A4 - Forma Recta",
       "Contrapunctus Inversus A3 - Forma Inversa", "Contrapunctus Inversus A3", "Canon Per Augmentationem in Contrario Motu", "Canon Alla Ottava", "Canon Alla Decima in Contrapunto Alla Terza",
       "Canon Alla Duodecima in Contrapunto Alla Quinta", "Fuga a3 Soggetti (completion by Pianist)"]
for i, name in enumerate(AOF, 1):
    nice = name.replace(" a 4", " à 4").replace(" a 3", " à 3").replace("(completion by Pianist)", "(completed by the pianist)")
    rec(f"AOF{i}", "AOF", f"Kimiko Ishizaka - J.S. Bach- The Art of the Fugue (Kunst der Fuge), BWV 1080 - {i:02d} {name}.mp3", f"The Art of Fugue, BWV 1080 · {nice}", "bach")

# ---------- Musopen-Libre (CC BY-SA 3.0) ----------
for key, f, t in [
    ("L-ERO1", "SymphonyNo.3InEFlatMajorEroica_Op.55-1.AllegroC.mp3", "Symphony No. 3 “Eroica” · I. Allegro con brio"),
    ("L-ERO2", "SymphonyNo.3InEFlatMajorEroica_Op.55-2.MarciaF.mp3", "Symphony No. 3 “Eroica” · II. Marcia funebre"),
    ("L-ERO3", "SymphonyNo.3InEFlatMajorEroica_Op.55-3.Scherzo.mp3", "Symphony No. 3 “Eroica” · III. Scherzo"),
    ("L-ERO4", "SymphonyNo.3InEFlatMajorEroica_Op.55-4.FinaleA.mp3", "Symphony No. 3 “Eroica” · IV. Finale"),
    ("L-S5-2", "SymphonyNo.5InCMinorOp.67-2.AndanteConMoto.mp3", "Symphony No. 5 in C minor, Op. 67 · II. Andante con moto"),
    ("L-S5-3", "SymphonyNo.5InCMinorOp.67-3.Allegro.mp3", "Symphony No. 5 in C minor, Op. 67 · III. Allegro"),
    ("L-S5-4", "SymphonyNo.5InCMinorOp.67-4.Allegro.mp3", "Symphony No. 5 in C minor, Op. 67 · IV. Allegro"),
    ("L-LZ5-2", "SymphonyNo.5f.LisztPianoTranscription-2AndanteConMoto-2128-7099.mp3", "Symphony No. 5 (Liszt piano transcription) · II. Andante con moto"),
    ("L-LZ5-4", "SymphonyNo.5f.LisztPianoTranscription-4Allegro-2128-7101.mp3", "Symphony No. 5 (Liszt piano transcription) · IV. Allegro"),
    ("L-S6-3", "SymphonyNo.6InFMajorpastoralOp.68-3.Allegro.mp3", "Symphony No. 6 “Pastoral” · III. Merry gathering of country folk"),
    ("L-S8-1", "SymphonyNo.8InFMajorOp.93-I.AllegroVivaceEConBrio.mp3", "Symphony No. 8 in F major, Op. 93 · I. Allegro vivace e con brio"),
    ("L-S8-2", "SymphonyNo.8InFMajorOp.93-Ii.AllegrettoScherzando.mp3", "Symphony No. 8 in F major, Op. 93 · II. Allegretto scherzando"),
    ("L-S8-3", "SymphonyNo.8InFMajorOp.93-Iii.TempoDiMenuetto.mp3", "Symphony No. 8 in F major, Op. 93 · III. Tempo di menuetto")]:
    rec(key, "LIB", f, t, "beethoven")
# ---------- Satie & Beethoven singles ----------
rec("SAT1-GN", "SAT1", "gnossiennes.mp3", "Trois Gnossiennes", "satie")
rec("SAT1-GY", "SAT1", "Satie.mp3", "Gymnopédie No. 1", "satie")
rec("SAT2-GN1", "SAT2", "Satie Gnossienne 1.mp3", "Gnossienne No. 1", "satie")
rec("SAT2-GN3", "SAT2", "Satie Gnossienne 3.mp3", "Gnossienne No. 3", "satie")
rec("SAT2-GY1", "SAT2", "Satie Gymnopedie 1.mp3", "Gymnopédie No. 1", "satie")
rec("SAT2-GY3", "SAT2", "Satie Gymnopedie 3.mp3", "Gymnopédie No. 3", "satie")
rec("KM-GY1", "KM", "gymnopedie-no-1-by-kevin-macleod.mp3", "Gymnopédie No. 1", "satie")
rec("MOON3", "MOON", "Sonata_no_14_in_c_sharp_minor_moonlight_op_27_no_2_Iii.Presto.mp3", "Piano Sonata No. 14 “Moonlight” · III. Presto agitato", "beethoven")

# ============================================================================
# The ten works
# ============================================================================
WORKS = [
 dict(t="DREAM OF THE RED CHAMBER", slug="dream-of-the-red-chamber", code="HLM", name="Dream of the Red Chamber", cn="紅樓夢",
      author="Cao Xueqin", authorCn="曹雪芹", era="清 · 十八世紀", accent="#9A6B76", ink="#5B3943",
      line="滿紙荒唐言，一把辛酸淚。",
      summary="太虛幻境開卷，大觀園裡的花與詩、宴與淚，終歸白茫茫一片。以巴哈〈詠嘆調〉首尾相扣，中間是蕭邦的夜曲與舒伯特的慢板，像一場不願醒來的夢。",
      tracks=[("G0", "太虛幻境 · 開卷"), ("M40-II", "元妃省親"), ("C42", "大觀園的月色"), ("C33", "沁芳閘邊共讀西廂"), ("C35", "瀟湘館竹影"),
              ("D664-II", "怡紅院的午後"), ("C36", "海棠詩社"), ("C26", "劉姥姥進大觀園"), ("LARK-II", "寶琴立雪"), ("C17", "元宵燈謎"),
              ("C4", "寶黛之間"), ("BQ2-III", "湘雲醉眠芍藥裀"), ("C11", "群芳開夜宴"), ("D568-II", "晴雯補裘"), ("C40", "中秋夜聞笛"),
              ("C15", "冷月葬花魂"), ("C31", "黛玉葬花"), ("G25", "秋窗風雨夕"), ("BR3-III", "繁華將散"), ("D959-II", "焚稿斷痴情"),
              ("C38", "魂歸離恨天"), ("G13", "好了歌"), ("D845-II", "懸崖撒手"), ("C41", "石頭記"), ("G31", "白茫茫大地真乾淨")]),
 dict(t="THE GOLDEN CANGUE", slug="the-golden-cangue", code="JSJ", name="The Golden Cangue", cn="金鎖記",
      author="Eileen Chang", authorCn="張愛玲", era="1943 · 上海", accent="#8C7B55", ink="#4E432C",
      line="三十年前的月亮，照著一副黃金的枷。",
      summary="曹七巧用黃金鎖住了自己，也鎖住了兒女的一生。選曲多是小調的夜曲與奏鳴曲，緩慢、壓抑、偶爾爆發，像那間永遠拉著窗簾的老宅。",
      tracks=[("C30", "三十年前的月亮"), ("C37", "姜公館的夜"), ("C34", "麻油店的女兒"), ("C28", "分家"), ("D784-I", "黃金的枷"),
              ("D784-II", "季澤來訪"), ("C24", "一場算計"), ("C21", "長安的口琴"), ("C18", "鴉片煙榻"), ("C39", "芝壽的夜"),
              ("C5", "月亮像一個白太陽"), ("C8", "七巧的瘋"), ("MQ6-I", "窒息"), ("MQ6-III", "長安退婚"), ("K421-I", "錢與情"),
              ("K421-II", "童世舫"), ("D958-II", "那一點真心"), ("BR4-II", "舊宅"), ("TCH6-I", "三十年的帳"), ("PG-2", "七巧之死"),
              ("C9", "走進沒有光的所在"), ("C27", "翠玉鐲子"), ("TCH6-IV", "枷角劈殺了幾個人"), ("K421-IV", "金鎖"), ("C32", "故事還沒完")]),
 dict(t="LOVE IN A FALLEN CITY", slug="love-in-a-fallen-city", code="QCZ", name="Love in a Fallen City", cn="傾城之戀",
      author="Eileen Chang", authorCn="張愛玲", era="1943 · 香港", accent="#857399", ink="#463A55",
      line="一座城市的淪陷，成全了一段愛情。",
      summary="白流蘇與范柳原在淺水灣飯店的月光下鬥智，戰火卻替他們做了決定。以圓舞曲、瑪祖卡與即興曲寫舞池裡的試探，薩提的〈格諾西安〉代替那把咿咿啞啞的胡琴。",
      tracks=[("SAT2-GN1", "胡琴咿咿啞啞"), ("C10", "白公館的舞"), ("C19", "范柳原"), ("C20", "淺水灣飯店"), ("ITAL-I", "南國的陽光"),
              ("C12", "海灘上的試探"), ("C14", "一場賭局"), ("TCH6-II", "你的窗子裡看得見月亮嗎"), ("DQ10-III", "地老天荒"), ("C22", "上海與香港之間"),
              ("C13", "鏡中的流蘇"), ("ITAL-II", "巴丙頓道的房子"), ("C16", "點燈"), ("BR2-III", "調情"), ("DQ10-II", "等待"),
              ("C7", "十二月八日"), ("C3", "炮火"), ("SUK", "淪陷"), ("BR3-I", "死生契闊"), ("D850-II", "與子相悅"),
              ("ITAL-III", "斷牆下"), ("C23", "平凡的夫妻"), ("LARK-I", "傾城之後"), ("BQ1-I", "到處都是傳奇"), ("SAT2-GN3", "胡琴咿咿啞啞拉著")]),
 dict(t="TAIPEI PEOPLE", slug="taipei-people", code="TPR", name="Taipei People", cn="台北人",
      author="Pai Hsien-yung", authorCn="白先勇", era="1971 · 台北", accent="#5F7F8F", ink="#30454F",
      line="舊時王謝堂前燕，飛入尋常百姓家。",
      summary="十四個從大陸來到台北的人，帶著上海的舞廳、南京的公館與桂林的米粉，活在回不去的昨天。選曲是懷舊的舞曲、鄉愁的慢板與遠方的河流。",
      tracks=[("DQ12-II", "舊時王謝堂前燕"), ("BR2-IIIb", "永遠的尹雪艷"), ("BR1-II", "一把青"), ("BQ6-IV", "歲除"), ("LARK-III", "金大班的最後一夜"),
              ("D959-IV", "思舊賦"), ("BQ6-II", "梁父吟"), ("C25", "孤戀花"), ("D664-I", "花橋榮記"), ("SCOT-III", "秋思"),
              ("G15", "滿天裡亮晶晶的星星"), ("BR2-II", "遊園驚夢"), ("BQ2-I", "冬夜"), ("L-ERO2", "國葬"), ("C2", "那片血一般紅的杜鵑花"),
              ("C1", "百樂門的夜"), ("VLT", "江水東流"), ("DQ12-I", "台北的雨季"), ("DQ12-IV", "重逢"), ("BQ1-IV", "新公園的夜"),
              ("DQ10-I", "中山北路的黃昏"), ("KM-GY1", "抽屜裡的舊照片"), ("SAT2-GY3", "夜深的巷口"), ("BR1-III", "舊日的舞步"), ("C29", "回不去的昨天")]),
 dict(t="CALL TO ARMS", slug="call-to-arms", code="NHN", name="Call to Arms", cn="吶喊",
      author="Lu Xun", authorCn="魯迅", era="1923 · 北京", accent="#7A6A60", ink="#40362F",
      line="假如一間鐵屋子，是絕無窗戶而萬難破毀的。",
      summary="狂人的日記、孔乙己的長衫、阿Q的辮子與故鄉的閏土。魯迅用冷峻的筆，在鐵屋裡發出一聲吶喊；選曲是貝多芬的命運與英雄、布拉姆斯的掙扎，也有一首像〈故鄉〉的慢板。",
      tracks=[("COR", "鐵屋子"), ("BR4-I", "狂人日記"), ("L-LZ5-4", "救救孩子"), ("SAT1-GY", "孔乙己"), ("CP6", "人血饅頭"),
              ("AOF3", "藥"), ("D845-I", "明天"), ("L-S5-2", "一件小事"), ("L-ERO1", "頭髮的故事"), ("L-S6-3", "風波"),
              ("BQ1-II", "故鄉"), ("L-LZ5-2", "閏土"), ("L-S5-3", "阿Q的辮子"), ("TCH6-III", "阿Q正傳"), ("L-S5-4", "大團圓"),
              ("L-S8-2", "端午節"), ("D958-IV", "白光"), ("L-ERO3", "兔和貓"), ("L-ERO4", "鴨的喜劇"), ("BQ2-II", "社戲"),
              ("SCOT-IV", "走的人多了，也便成了路"), ("BR1-I", "吶喊"), ("M40-IV", "看客"), ("BQ6-I", "覺醒"), ("BR1-IV", "希望")]),
 dict(t="JOURNEY UNDER THE MIDNIGHT SUN", slug="journey-under-the-midnight-sun", code="BYX", name="Journey Under the Midnight Sun", cn="白夜行",
      author="Keigo Higashino", authorCn="東野圭吾", era="1999 · 大阪", accent="#5E6880", ink="#2F3547",
      line="我的天空裡沒有太陽，總是黑夜，但並不暗。",
      summary="一樁當鋪命案之後，亮司與雪穗在白晝裡永不相交，卻在暗處互相照亮了十九年。以巴哈冷靜精密的卡農與賦格為骨，像兩條追隨卻永不重疊的旋律。",
      tracks=[("WTC-P1", "1973 · 大阪"), ("WTC-F2", "命案"), ("G3", "兩個孩子"), ("WTC-P4", "通風管"), ("G9", "剪紙"),
              ("WTC-F4", "雪穗"), ("G12", "白晝之下"), ("AOF1", "亮司"), ("WTC-P6", "影子"), ("G18", "各自的人生"),
              ("WTC-P8", "沒有太陽的天空"), ("AOF6", "代替太陽的東西"), ("G21", "互相照亮"), ("WTC-F8", "十九年"), ("SAT1-GN", "R&Y"),
              ("G24", "追查"), ("WTC-P10", "笹垣刑警"), ("AOF9", "偽造"), ("G27", "黑夜並不暗"), ("WTC-F12", "聖誕夜"),
              ("G28", "剪刀"), ("AOF11", "白夜"), ("WTC-P14", "最後的回頭"), ("G29", "墜落"), ("AOF20", "一次也沒有回頭")]),
 dict(t="IN SEARCH OF THE SUPERNATURAL", slug="in-search-of-the-supernatural", code="SSJ", name="In Search of the Supernatural", cn="搜神記",
      author="Gan Bao", authorCn="干寶", era="東晉 · 四世紀", accent="#5D766C", ink="#2F4039",
      line="發明神道之不誣。",
      summary="干寶蒐集上古神仙、鬼魅與異物：干將莫邪鑄劍、宋定伯捉鬼、李寄斬蛇、韓憑夫婦化為相思樹。選曲是帶著魔法與夜色的序曲、組曲與賦格。",
      tracks=[("FLUTE", "序 · 發明神道之不誣"), ("PG-1", "神農鞭百草"), ("G16", "干將莫邪"), ("RIM", "三王墓"), ("PG-4", "李寄斬蛇"),
              ("G20", "宋定伯捉鬼"), ("PG-3", "毛衣女"), ("G7", "董永遇仙"), ("WTC-P13", "相思樹"), ("SAT2-GY1", "紫玉"),
              ("STEP", "盤瓠"), ("AOF7", "蠶馬"), ("MQ6-IV", "東海孝婦"), ("WTC-P3", "嫦娥奔月"), ("WTC-P7", "弦超與智瓊"),
              ("G22", "盧充幽婚"), ("BQ1-III", "狐魅"), ("SCOT-I", "夜行的鬼"), ("BR4-III", "山中異物"), ("AOF16", "陰陽相背"),
              ("G26", "赤松子"), ("WTC-F3", "琴高乘鯉"), ("DQ12-III", "西王母的青鳥"), ("AOF17", "魂歸"), ("WTC-F7", "千年之後，仍有人說起")]),
 dict(t="ROBINSON CRUSOE", slug="robinson-crusoe", code="RBC", name="Robinson Crusoe", cn="魯賓遜漂流記",
      author="Daniel Defoe", authorCn="笛福", era="1719 · London", accent="#4F7487", ink="#2A4250",
      line="一個人、一座島、二十八年。",
      summary="出海、船難、荒島。克魯索在無人之地建屋、種麥、記帳、禱告，直到在沙灘上看見一個腳印。以巴哈的秩序寫獨處的日子，以孟德爾頌的海與島寫遠方。",
      tracks=[("HEB", "出海"), ("D784-III", "船難"), ("G1", "漂上岸"), ("WTC-P2", "搶救船上的物資"), ("WTC-F1", "搭起帳篷"),
              ("G2", "刻木記日"), ("G4", "種下大麥"), ("WTC-P5", "做陶罐"), ("G5", "養羊"), ("G6", "鸚鵡波爾"),
              ("WTC-F5", "築牆"), ("G8", "造獨木舟"), ("BR2-I", "島上的四季"), ("G10", "好處與壞處的帳"), ("WTC-P11", "讀聖經"),
              ("G11", "病中的禱告"), ("D958-I", "沙灘上的一個腳印"), ("G14", "篝火"), ("LARK-IV", "星期五"), ("G17", "教星期五說話"),
              ("WTC-F11", "兩個人的島"), ("G19", "叛變的船"), ("D850-III", "重返大海"), ("BR2-IV", "回到英國"), ("G23", "二十八年兩個月又十九天")]),
 dict(t="PRIDE AND PREJUDICE", slug="pride-and-prejudice", code="PNP", name="Pride and Prejudice", cn="傲慢與偏見",
      author="Jane Austen", authorCn="珍·奧斯汀", era="1813 · Hertfordshire", accent="#8E7189", ink="#4F3B4C",
      line="凡是有錢的單身漢，總想娶位太太，這是舉世公認的真理。",
      summary="浪博恩的五個女兒、尼日斐花園的舞會、彭伯里的長廊。伊莉莎白與達西在誤會與自尊之間慢慢看清彼此；選曲是莫札特、海頓與舒伯特的客廳音樂與舞曲。",
      tracks=[("FIG", "舉世公認的真理"), ("D568-I", "浪博恩"), ("K465-I", "第一印象"), ("K465-III", "麥里屯的舞會"), ("K465-IV", "班奈特太太"),
              ("D568-III", "尼日斐花園的舞會"), ("K465-II", "伊莉莎白"), ("M40-III", "柯林斯先生求婚"), ("WTC-P9", "瑪麗的琴"), ("WTC-F10", "書房裡的班奈特先生"),
              ("BQ6-III", "凱瑟琳夫人"), ("D850-I", "漢斯福的求婚"), ("MOON3", "徒勞的掙扎"), ("D568-IV", "一封信"), ("D959-III", "賓利先生"),
              ("SCOT-II", "到德比郡去"), ("D959-I", "彭伯里"), ("L-S8-3", "客廳裡的鋼琴"), ("D664-III", "莉迪亞私奔"), ("D958-III", "羅辛斯的晚宴"),
              ("ITAL-IV", "舞到天亮"), ("L-S8-1", "浪博恩的早晨"), ("D845-IV", "第二次求婚"), ("D850-IV", "彭伯里的春天"), ("G30", "兩場婚禮")]),
 dict(t="A TALE OF TWO CITIES", slug="a-tale-of-two-cities", code="TTC", name="A Tale of Two Cities", cn="雙城記",
      author="Charles Dickens", authorCn="狄更斯", era="1859 · London / Paris", accent="#7C5A63", ink="#432F35",
      line="那是最好的時代，也是最壞的時代。",
      summary="倫敦與巴黎、斷頭台與編織的毛線針。卡頓為所愛之人走上刑台：「我現在做的，遠比我做過的一切都美好。」選曲是英雄、命運與悲劇，最後是一座正在升起的美麗城市。",
      tracks=[("ERO-I", "最好的時代，最壞的時代"), ("M40-I", "街上破裂的酒桶"), ("WTC-P12", "北塔一〇五號"), ("WTC-F6", "鞋匠"), ("ERO-III", "往多佛的郵車"),
              ("BR3-II", "金色的線"), ("BQ2-IV", "老貝利法庭"), ("AOF13", "兩個相像的人"), ("D845-III", "侯爵的馬車"), ("MQ6-II", "德法奇太太的毛線針"),
              ("AOF8", "巴黎的夜"), ("EGM", "攻陷巴士底"), ("BR3-IV", "聖安東尼的浪潮"), ("WTC-F14", "倫敦的霧"), ("DQ10-IV", "渡海回法國"),
              ("AOF12", "雪梨·卡頓"), ("BR4-IV", "革命法庭"), ("AOF10", "醫生的信"), ("AOF15", "編織者"), ("TRAG", "斷頭台"),
              ("AOF14", "囚車"), ("AOF19", "與女裁縫同行"), ("ERO-II", "遠比我做過的一切都美好"), ("WTC-F13", "我看見一座美麗的城市"), ("ERO-IV", "死而復生")]),
]

def url(r):
    return IA + r["item"] + "/" + "/".join(urllib.parse.quote(p) for p in r["path"].split("/"))

out, used = [], {}
for w in WORKS:
    assert len(w["tracks"]) == 25, (w["slug"], len(w["tracks"]))
    tracks = []
    for i, (key, note) in enumerate(w["tracks"], 1):
        r = R[key]; comp, compCn, died = COMPOSER[r["comp"]]
        used.setdefault(key, []).append(w["slug"])
        tracks.append({
            "title": r["title"], "artist": comp, "composerCn": compCn, "composerDied": died, "performer": r["performer"],
            "note": note, "vibe": f"{note} · {compCn} · {w['cn']}",
            "stream": url(r), "source": f"https://archive.org/details/{r['item']}", "license": r["license"],
            "licenseEvidence": f"Internet Archive item “{r['item']}” · {r['license']} · composer d. {died}",
            "masterId": f"ia:{r['item']}/{r['path']}", "shareId": f"{w['slug']}-{i:03d}", "trackNo": i, "curatedTheme": w["t"],
        })
    out.append({k: w[k] for k in ("t", "slug", "code", "name", "cn", "author", "authorCn", "era", "accent", "ink", "line", "summary")} | {"tracks": tracks})

dups = {k: v for k, v in used.items() if len(v) > 1}
assert not dups, dups
PRESERVE_LITERATURE_KEYS = {"ROBINSON CRUSOE","PEACH BLOSSOM SPRING","XIANG YU ANNALS","MEMORIAL ON THE NORTHERN EXPEDITION","STRANGE TALES FROM A CHINESE STUDIO","ONE THOUSAND AND ONE NIGHTS","THE SCHOLARS","TO LIVE","THE PLUM IN THE GOLDEN VASE"}
existing_path = ROOT / "src" / "literature.json"
if existing_path.exists():
    try:
        previous = json.loads(existing_path.read_text(encoding="utf-8"))
        prev_by_t = {w.get("t"): w for w in previous if w.get("t") in PRESERVE_LITERATURE_KEYS}
        out = [prev_by_t.get(w.get("t"), w) for w in out]
        present = {w.get("t") for w in out}
        out.extend(w for k, w in prev_by_t.items() if k not in present)
    except Exception:
        pass
existing_path.write_text(json.dumps(out, ensure_ascii=False, indent=0), encoding="utf-8")
print(f"literature: {len(out)} works, {sum(len(w['tracks']) for w in out)} tracks, {len(used)} distinct recordings")
