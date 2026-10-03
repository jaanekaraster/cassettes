## Family Archive

A small, open, portable digital archive for family recordings.

The initial application is a static listening and search interface for archival recordings digitized from family reels. Original digitizations are preserved separately and offline. The website uses MP3 derivatives for convenient browser playback.

### Architecture

The archive has three independent layers:

- Archive metadata — JSON files stored in this private Git repository.
- Static website — generated from the JSON data and deployed as a static site.
- Media storage — MP3s, photographs, and scanned documents stored in S3-compatible object storage, initially Cloudflare R2.
- The repository is the source of truth for metadata. R2 is the source of truth for web media files.
- There is intentionally no database or application server in v1.

### Repository structure
```
data/
  people/
  songs/
  recordings/

site/
  index.html
  app.js
  styles.css

config/
  media.json

scripts/
  validate-data.js
```

### Data model

**Person**
A person represented in the archive.
```
{
  "id": "person-001",
  "name": "Full Name",
  "display_name": "Preferred Display Name",
  "description": "",
  "photos": [
    {
      "path": "photos/person-001-01.jpg",
      "caption": ""
    }
  ]
}
```

- name is the canonical name.
- display_name is the name used in compact website displays.
- Photos are currently embedded as simple references on the person record. A separate Photo entity is not required for v1.

**Song**
A musical work or song referenced by one or more recordings.

```
{
  "id": "song-001",
  "title": "English Display Title",
  "original_title": {
    "language": "Marathi",
    "script": "मराठी गाणे",
    "transliteration": "Marathi Gaane"
  },
  "language": "Marathi",
  "reference": {
    "type": "youtube",
    "url": "https://www.youtube.com/watch?v=EXAMPLE"
  },
  "description": "",
  "lyrics": {
    "original": null,
    "english": null
  }
}
```

- title is the English display title chosen for this archive.
- original_title preserves the title in the original language/script and an English transliteration.
- reference is an optional reference to the professional/original song, normally a YouTube URL. It is not a reference to the family recording.
- lyrics is reserved for future use.
- A song may have zero or more recordings.

**Recording**

A particular archival recording of a song.

```
{
  "id": "rec-001",
  "song_id": "song-001",
  "reel": {
    "id": "12_s1",
    "size": "5\""
  },
  "type": "audio",
  "participants": [
    {
      "person_id": "person-001",
      "role": "singer"
    }
  ],
  "audio": {
    "path": "audio/rec-001.mp3"
  },
  "duration_seconds": 154,
  "description": "",
  "comments": "",
  "documents": [
    {
      "type": "reel_information",
      "path": "documents/reel-12.jpg"
    }
  ],
  "date": {
    "value": "1968",
    "precision": "year"
  }
}
``

- reel.id identifies the original reel and side, for example 12_s1 means reel 12, side 1.
- reel.size records the original reel size.
- participants references people by ID and allows a role to be recorded.
- audio.path is a storage-relative path to the web MP3.
- duration_seconds is stored numerically and formatted by the frontend.
- documents is an array because a recording may eventually have several related scans or documents.
- date may contain day, month, or year precision. If the date is unknown, use null.

### Relationships

The core relationships are:
```
Person ←── participants ──→ Recording ──→ Song
  │
  └── photos
```

- A song can have multiple recordings.
- A person can participate in many recordings.
- A recording can have multiple participants.
- A person can have multiple photographs.

### Media storage
- Media files are not stored in Git.
- Recommended object paths:

```
audio/rec-001.mp3
audio/rec-002.mp3

photos/person-001-01.jpg

documents/reel-12.jpg
```

The frontend combines the configured media base URL with these relative paths.

For example:

```
media base URL:
https://media.example.com

path:
audio/rec-001.mp3

result:
https://media.example.com/audio/rec-001.mp3

```

### Original digitizations
- The original digitized reel files are not part of this web archive.
- They should remain in separate offline archival storage.
- The web archive uses MP3 derivatives for browser playback.

### Editing workflow

For a new recording:
1. Get the path to the WAV file. If stored on D://, connect first: `sudo mount -t drvfs D: /mnt/d`
2. Upload it as MP3 to the R2 audio/ prefix: `scripts/upload_audio.sh "path/to/wav/file.wav" "audio/file.mp3"`
3. Upload any photographs or scanned documents to their R2 prefixes.
4. Create or update the relevant JSON records. 
5. Build the data into the site: `node scripts/build-data.js`
6. Validate the JSON: `node scripts/validate-data.js`
7. Check the site: 
```
cd site
npx serve . -l 9000
```

6. Commit the changes to Git.
7. Push to the repository.
8. Build and deploy the static site.

### Design principles
- Keep the archive portable.
- Keep metadata independent of the storage provider.
- Keep media outside Git.
- Avoid a database until there is a concrete need for one.
- Avoid application-server infrastructure until there is a concrete need for it.
- Use stable IDs for entities.
- Prefer explicit relationships over duplicated names.
- Keep the original digitizations separate from web derivatives.
- Treat the JSON metadata as the canonical archive description.
- Keep the frontend replaceable.

### Current scope

The initial website should provide:
- recording/song listing
- text search
- basic filtering
- audio playback
- song information
- recording information
- participant names
- dates
- reel information
- links to relevant documents
- optional photographs

The initial website does not need:
- user accounts
- an admin interface
- a database
- an API
- server-side rendering
- private audio delivery
- upload functionality
- preservation management
- automatic audio transcoding