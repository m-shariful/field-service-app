# Architecture

## Overview

The application follows a layered architecture with an
offline-first mobile client and a RESTful backend.

## High-Level Architecture

```text
React Native / Expo Mobile App
            |
            v
       UI / Screens
            |
            v
     State / Hooks
            |
            v
       Repository
       /        \
      v          v
 Local DB     Sync Engine
                  |
                  v
               REST API
                  |
                  v
             Backend API
                  |
             +----+----+
             |         |
             v         v
         PostgreSQL   Redis
```
