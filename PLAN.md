Family Archive Development Plan
Goal

Build a small, portable, static family archive website for browsing and listening to digitized recordings.

The first version should be intentionally simple.

Requirements
Archive

Approximately 50 existing recordings.

Original digitizations already exist elsewhere.

Website uses MP3 derivatives.

One curator maintains the archive.

Metadata contains family names and is therefore stored in a private Git repository.

Website is semi-public and accessible by URL.

Audio itself is not considered private.

R2 media can be publicly readable.

Metadata

The archive contains:

people

songs

recordings

photographs attached to people

scanned documents attached to recordings

song references

lyrics reserved for future use

Website

The first website should provide:

recording list

search

basic filtering

audio playback

song information

recording information

participant information

dates

reel information

documents

person photographs

Architecture
Private Git repository
        |
        | JSON metadata
        | static-site source
        |
        v
Static build
        |
        v
Public static website
        |
        |
        v
Public R2 media
        |
        +-- audio/
        +-- photos/
        +-- documents/


The original digitizations remain offline and outside this architecture.

Phase 1 — Repository scaffold

Create:

AGENTS.md
PLAN.md
README.md
.gitignore

data/
  people/
  songs/
  recordings/

config/
  media.json

site/
  index.html
  app.js
  styles.css

scripts/
  validate-data.js


Add JSON templates for Person, Song, and Recording.

Do not add a database.

Do not add a backend.

Phase 2 — Data validation

Implement a small validation script.

It should:

parse all JSON files

detect duplicate IDs

verify song references

verify person references

validate required fields

validate dates

validate participant structure

validate media paths

validate YouTube references

The validation script should exit non-zero when invalid data is found.

Phase 3 — Minimal static website

Build a single-page application/site that:

loads the archive metadata

lists recordings

displays the song title

displays participants

displays date

displays reel ID

provides an audio player

provides search

Do not implement routing unless it becomes useful.

The first page should be useful even if it remains visually simple.

Phase 4 — Relationships

Add:

song detail display

person information

filtering by person

filtering by language

filtering by year

links to documents

photographs

Keep all functionality client-side.

Phase 5 — R2 integration

Configure:

audio/
photos/
documents/


as the initial object prefixes.

Store only relative paths in JSON.

Configure the static application with a single media base URL.

Example:

https://media.example.com


The application combines it with paths such as:

audio/rec-001.mp3

Phase 6 — Deployment

The repository should produce a completely static build.

GitHub Pages is the initial candidate deployment target.

Important constraint:

GitHub Pages on GitHub Free requires a public repository. Because archive metadata contains family names, the archive repository should remain private.

Therefore:

If using GitHub Pro/Team/Enterprise, private-repository GitHub Pages can be used.

If remaining on GitHub Free, deploy the static build to another suitable static host while keeping the source repository private.

Do not make the metadata repository public merely to use GitHub Pages.

Phase 7 — Populate archive

Migrate the existing approximately 50 recordings.

For each recording:

Confirm the reel ID.

Confirm reel size.

Create or identify the Song.

Create or identify participating People.

Upload the MP3 to R2.

Upload associated documents/photos to R2.

Create the Recording JSON.

Run validation.

Review playback.

Commit.

Phase 8 — Evaluate

After the initial archive is populated, evaluate:

search usability

metadata completeness

playback reliability

mobile usability

R2 organization

build/deployment simplicity

whether a local editing tool would actually save time

Only then consider adding an admin interface or database.

Explicitly deferred

Do not implement initially:

user authentication

user accounts

upload UI

admin dashboard

backend API

PostgreSQL

server-side search

audio streaming server

automatic transcoding

preservation management

user comments

collaborative editing

complex photo management

Architectural principle

The archive must remain portable.

A future developer should be able to take:

data/


and understand the archive without needing the website, database, hosting provider, or R2 account.

The frontend and media provider are replaceable layers.