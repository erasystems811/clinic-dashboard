#!/bin/sh
case "$SERVICE_NAME" in
  api-server)
    exec pnpm --filter @workspace/api-server run start
    ;;
  era-me)
    exec node artifacts/era-me/server.cjs
    ;;
  era-super-admin)
    exec node artifacts/era-super-admin/server.cjs
    ;;
  *)
    exec node artifacts/era-patient/server.cjs
    ;;
esac
