AGENTS.md
Project

This repository contains a small static family archive website.

The archive catalogs recordings digitized from historical family reels. The website is a convenient listening and search interface, not the primary preservation system.

Core architecture

The project has three layers:

JSON archive metadata in Git.

A static frontend generated from that metadata.

Public web media stored outside Git in S3-compatible object storage.

The initial media provider is Cloudflare R2.

There is intentionally no database or backend API in v1.

Do not introduce a database, server, authentication system, or CMS unless there is a documented requirement that cannot reasonably be satisfied by the current architecture.

Source of truth

The Git repository is authoritative for archive metadata.

R2 is authoritative for web media files.

Original digitized recordings are outside this repository and outside the web media bucket.

Do not place original archival digitizations in Git.

Do not commit MP3s, photographs, or scanned documents to Git unless explicitly requested.

Data model

There are three primary entities:

Person

Song

Recording

Person

A person has:

id

name

display_name

description

photos

Song

A song has:

id

title

original_title

language

optional reference

description

reserved lyrics

The archive title is the English display title selected for the archive.

The reference refers to the professional/original song where available, not the family recording.

Recording

A recording has:

id

song_id

reel

type

participants

audio

duration_seconds

description

comments

documents

date

Participants reference people by ID.

Do not duplicate person names in recording metadata when a person ID can be used.

IDs

Use stable IDs such as:

person-001
song-001
rec-001


Do not derive application IDs from display names.

Reel identifiers such as 12_s1 are archival identifiers and should not automatically be treated as recording IDs.

Dates

Represent known dates using:

{
  "value": "1968-04-17",
  "precision": "day"
}


or:

{
  "value": "1968",
  "precision": "year"
}


Unknown dates are:

null


Do not use "unknown" as a date value.

Media paths

Metadata should contain storage-relative paths:

{
  "audio": {
    "path": "audio/rec-001.mp3"
  }
}


Do not hard-code the R2 hostname into individual records.

The media base URL belongs in project configuration.

R2

R2 media is intentionally public for the current beta archive.

Never put R2 credentials, API tokens, secret keys, or private configuration into:

Git

JSON metadata

frontend JavaScript

HTML

CSS

GitHub Pages artifacts

The browser must only receive public media URLs.

Upload credentials belong on the curator's local machine or in a secure deployment environment.

Frontend

The frontend is static.

Prefer client-side functionality using the JSON archive data.

Do not add a server dependency merely to implement:

search

filtering

audio playback

entity relationships

basic navigation

For the current archive size, these should work entirely in the browser.

Editing metadata

When adding a recording:

Create or update the appropriate Person records.

Create or update the Song record.

Create the Recording record.

Upload its MP3 to R2.

Upload associated documents/photos to R2.

Check all IDs and paths.

Run validation.

Review the generated site locally.

Commit the changes.

Validation

Data validation should catch at least:

malformed JSON

duplicate IDs

missing referenced person IDs

missing referenced song IDs

invalid recording dates

invalid date precision

missing audio paths

invalid participant objects

malformed reference URLs

missing required fields

Do not silently repair metadata during validation.

Report errors clearly and let the curator correct the source JSON.

Preservation

The web archive is not the preservation archive.

Do not recommend deleting or replacing original digitizations because a web MP3 exists.

The original files remain separate and offline.

Changes

Prefer small, understandable changes.

Do not introduce dependencies unless they solve a concrete requirement.

Do not replace the data model merely to suit a frontend library.

The archive data should remain usable independently of the frontend.

Future architecture

Possible future additions include:

local/admin editing interface

SQLite generated from JSON

richer search

people pages

richer photograph/document entities

additional media formats

alternative static hosting

a database-backed application

These are future possibilities, not current requirements.

Any future architecture should preserve the portability of the JSON archive.