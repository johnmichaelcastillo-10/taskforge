# Taskforge REST API

A JSON API for your projects, tasks and timer, at `/api/v1`. It does what the app does, with the
same rules: you only ever see your own data, and archived projects are read-only.

## Authentication

Create a personal access token in **Settings → API tokens**. The token is shown once; only a
hash of it is stored. Send it in every request:

```http
Authorization: Bearer tf_…
```

- Tokens work only on `/api/v1`. The app's session cookie doesn't work there, and tokens don't
  work on the app's own routes.
- A token stops working when it's revoked or its account is deleted. A demo account, and its
  tokens, are deleted when the demo expires.
- You can have up to 10 tokens.

## Examples

Bash (Linux, macOS, WSL):

```bash
export TASKFORGE_URL=http://localhost:8094
export TASKFORGE_TOKEN=tf_…

# Who am I?
curl -s -H "Authorization: Bearer $TASKFORGE_TOKEN" "$TASKFORGE_URL/api/v1/me"

# Create a project, then a task in it
curl -s -X POST -H "Authorization: Bearer $TASKFORGE_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Release 2.0","priority":"high","deadline":"2026-12-01"}' \
  "$TASKFORGE_URL/api/v1/projects"

curl -s -X POST -H "Authorization: Bearer $TASKFORGE_TOKEN" -H "Content-Type: application/json" \
  -d '{"projectId":1,"title":"Write the changelog","status":"todo","estimateMinutes":90}' \
  "$TASKFORGE_URL/api/v1/tasks"

# Time it, then finish it (finishing a task stops its timer)
curl -s -X POST -H "Authorization: Bearer $TASKFORGE_TOKEN" -H "Content-Type: application/json" \
  -d '{"taskId":1}' "$TASKFORGE_URL/api/v1/timer/start"

curl -s -X POST -H "Authorization: Bearer $TASKFORGE_TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"done","position":0}' "$TASKFORGE_URL/api/v1/tasks/1/move"
```

PowerShell (Windows):

```powershell
$url = 'http://localhost:8094'
$headers = @{ Authorization = 'Bearer tf_…' }

Invoke-RestMethod -Headers $headers "$url/api/v1/me"

$project = Invoke-RestMethod -Method Post -Headers $headers -ContentType 'application/json' `
  -Body (@{ name = 'Release 2.0'; priority = 'high' } | ConvertTo-Json) "$url/api/v1/projects"

Invoke-RestMethod -Method Post -Headers $headers -ContentType 'application/json' `
  -Body (@{ projectId = $project.project.id; title = 'Write the changelog' } | ConvertTo-Json) "$url/api/v1/tasks"
```

## Endpoints

| Method and path | What it does |
|---|---|
| `GET /me` | The token's account |
| `GET /projects` | Your projects. `?archived=true` for archived ones; `?status=`, `?q=` (name contains) |
| `POST /projects` | Create a project |
| `GET /projects/:id` | One project, with `taskCount` and `doneCount` |
| `PATCH /projects/:id` | Change fields; `{"archived": true}` archives, `false` restores |
| `DELETE /projects/:id` | Delete the project and everything in it |
| `GET /projects/:id/tasks` | The project's tasks in board order; `?status=`, `?priority=`, `?tagId=`, `?q=` |
| `GET /tasks` | Your tasks; `?projectId=` and the same filters |
| `POST /tasks` | Create a task (at the bottom of its column) |
| `GET /tasks/:id` | One task |
| `PATCH /tasks/:id` | Change fields; a new `status` moves it to the bottom of that column |
| `POST /tasks/:id/move` | `{"status": "in_progress", "position": 0}`: column and place (0 = top) |
| `DELETE /tasks/:id` | Delete the task with its comments and sessions |
| `GET /timer` | `{"running": session}` or `{"running": null}` |
| `POST /timer/start` | `{"taskId": 1}`; add `"switch": true` to stop a timer on another task first |
| `POST /timer/stop` | Stop the running timer; returns the session |

Successful responses wrap the record by name: `{"project": …}`, `{"tasks": […]}`. Deletes return
`204 No Content`.

## Fields

**Project:**

| Field | Values |
|---|---|
| `name` | 1–100 characters (required) |
| `description` | Up to 2000 characters |
| `status` | `planning`, `in_progress` or `completed` |
| `priority` | `low`, `medium` or `high` |
| `startDate` | `YYYY-MM-DD` or `null` |
| `deadline` | `YYYY-MM-DD` or `null`, not before the start date |

**Task:**

| Field | Values |
|---|---|
| `projectId` | Required when creating |
| `title` | 1–200 characters (required) |
| `description` | Up to 5000 characters |
| `status` | `backlog`, `todo`, `in_progress` or `done` |
| `priority` | `low`, `medium` or `high` |
| `dueDate` | `YYYY-MM-DD` or `null` |
| `estimateMinutes` | 1–99999, or `null` |
| `tagIds` | Up to 10 of your tag ids |

Read-only fields:

| Field | Meaning |
|---|---|
| `completedAt` | Set when the task enters Done, cleared when it leaves |
| `trackedSeconds` | Total tracked time; a running timer counts up to now |
| `commentCount` | Number of comments |
| `projectName` | Name of the task's project |

Timestamps are ISO 8601 in UTC; calendar dates are `YYYY-MM-DD`. Durations are always
measured by the server: a duration sent by a client is ignored.

## Errors

Errors use HTTP status codes, with a JSON body whose `message` explains the problem:

| Status | When |
|---|---|
| `400` | Invalid input. `data.fieldErrors` maps each field to its messages |
| `401` | No valid token. The response includes `WWW-Authenticate: Bearer` |
| `404` | Not found, or not yours: the two look the same |
| `409` | Conflicts with the current state: the project is archived, a timer is already running (`data.running` says where), the task is done, or the token limit is reached |
| `429` | Rate limited. `Retry-After` says how many seconds to wait |

```json
{
  "statusCode": 400,
  "message": "Check the highlighted fields.",
  "data": { "fieldErrors": { "name": ["Enter a name."] } }
}
```

## Limits

- Each token may make 120 requests a minute.
- Date ranges in the app's analytics are capped at a year.
