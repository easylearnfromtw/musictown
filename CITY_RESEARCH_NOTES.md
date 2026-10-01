# City pool research logic

The fresh-city builder uses Nullrights because its public catalog states that every recording is CC0,
and track pages expose genre/tags, vocal analysis, duration and download/source metadata.

Profiles:

- TAIPEI DREAM — indie vocal / bedroom pop / lo-fi / folk / dream pop
- OLD TOKYO — synth pop / retro pop / disco / funk pop / synthwave
- SPLENDOR SHANGHAI — jazz vocal / soul / blues / swing / vintage lounge
- VANCOUVER — folk / acoustic / indie folk / dreamy / mellow / ambient vocal
- LONDON — post-punk / art pop / indie rock / new wave / experimental pop
- NEW YORK — soul / funk / jazz-funk / urban pop / hip-hop / R&B vocal

The builder does not accept a track only because the title sounds suitable.
It reads the track page, verifies CC0 1.0 Universal and `Has vocals`, scores its sound metadata,
then enforces global de-duplication.
