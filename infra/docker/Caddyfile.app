{
	auto_https off
}

:{$EDGE_PORT} {
	encode gzip zstd

	@api path /api/trpc* /api/auth/* /api/health /api/healthz
	handle @api {
		uri strip_prefix /api
		reverse_proxy {$API_UPSTREAM} {
			header_up Host {upstream_hostport}
		}
	}

	handle {
		root * /srv
		try_files {path} /index.html
		file_server
	}
}
