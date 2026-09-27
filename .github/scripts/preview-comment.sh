#!/usr/bin/env bash
# Keeps a single preview comment on pull request $PR: updates the one this workflow posted before,
# or posts it. The body is the first argument. Needs GH_TOKEN, PR and GITHUB_REPOSITORY.
set -euo pipefail

marker='<!-- netlify-preview -->'
body="$marker
$1"

id=$(gh api "repos/$GITHUB_REPOSITORY/issues/$PR/comments" --paginate \
	--jq ".[] | select(.user.login == \"github-actions[bot]\" and (.body | startswith(\"$marker\"))) | .id" |
	head -n 1)

if [ -n "$id" ]; then
	gh api -X PATCH "repos/$GITHUB_REPOSITORY/issues/comments/$id" -f body="$body" > /dev/null
else
	gh api "repos/$GITHUB_REPOSITORY/issues/$PR/comments" -f body="$body" > /dev/null
fi
