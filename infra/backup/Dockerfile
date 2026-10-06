# Backup sidecar: pg_dump 17 (matches the server), rclone for optional off-site copies,
# curl for the heartbeat. Built on the VM by `docker compose build backup`.
FROM postgres:18-alpine
RUN apk add --no-cache rclone curl tzdata
ENV TZ=Asia/Kolkata
COPY backup.sh restore.sh schedule.sh /usr/local/bin/
RUN chmod 0755 /usr/local/bin/backup.sh /usr/local/bin/restore.sh /usr/local/bin/schedule.sh
ENTRYPOINT []
CMD ["schedule.sh"]
