## Journal Process

### 1. Digitization [~72 hours]
Tools: 
- Sony TC-910
- Reel sets: 3", 5", 7.5" 
- K'nex rig adapter to play 7" tapes on the 3" heads
- Connect Zoom H8 to Sony TC-910.

---------------------------------------------------
Hardware setup: 

          ┌───────────────────┐
          │    Sony TC-910    │
          │  Reel-to-Reel     │
          └─────────┬─────────┘
                    │
             Line-level audio
                    │
              ┌─────▼─────┐
              │  Zoom H8  │
              │ Recorder /│ ◄──── 3.5 mm headphones (monitoring)
              │ USB Audio │
              │ Interface │
              └─────┬─────┘
                    │
                 USB-C
                    │
                    ▼
          ┌───────────────────┐
          │      Laptop       │
          │     Audacity      │
          │  Record / Edit /  │
          │      Export       │
          └───────────────────┘

---------------------------------------------------

Let it run for the entirety of the reel. Monitor progress via Audacity and headphones.
Pay attention to the volume--not too low to obscure the recording, but not too high so as to produce feedback.

Output: 
- 1 `.aup` file per reel
- 1 `.wav` export from the `.aup` file

### 2. Tagging and Identification [~6 hours]
Resources: 
- Russian/Yiddish experts (Shazam not helpful for song covers)
- Manual tagging

Output: 
- Complete spreadsheet with song names (original/transliterated/translated to English), YouTube recording links, lyrics (original/transliterated/translated to English)
- `recordings.csv`, `songs.csv`, and `people.csv`

### 3. Labeling in Audacity [~6 hours]
Resources: 
- Audacity

1. Open the `.aup` file for each reel. 
2. Do the labeling using CTRL+B to divide up the sections. Label each section as `[reel number]_s[side number]_[name]_[optional number]`, i.e. `4_s2_tishina_1` for a reel which has multiple instances of Tishina on the same reel. 

Output:
- 1 folder per labeled reel, in which there will be 1 `.wav` file per song.

### 4. Upload songs to Cloudflare R2 [~5 minutes]
Use the script `scripts/upload-audio.sh` to upload each song to R2. 

### 5. Run the scripts to update the site
```
node scripts/csv-to-people.cjs
node scripts/csv-to-recordings.cjs
node scripts/csv-to-songs.cjs
node scripts/build-data.js
node scripts/validate-data.js

# Then commit and push
git push
```