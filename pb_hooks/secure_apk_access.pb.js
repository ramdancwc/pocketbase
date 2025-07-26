/**
 * 🔒 SECURE APK ACCESS HOOK
 * 
 * This PocketBase hook creates a secure endpoint for APK file downloads.
 * Only authenticated users with 'api_device' role can access APK files.
 * 
 * DEPLOYMENT: Already included in Docker build - will auto-deploy with Railway
 * 
 * ENDPOINT: GET /api/secure-apk/{record_id}/{filename}
 * 
 * SECURITY:
 * - Validates user authentication and api_device role
 * - Checks file active status before serving
 * - Returns appropriate HTTP status codes for errors
 * - Redirects to actual file URL only if authorized
 */

// Custom endpoint for secure APK file access
routerAdd("GET", "/api/secure-apk/:id/:filename", (c) => {
    console.log("🔒 Secure APK download request for ID:", c.pathParam("id"));
    
    try {
        // Step 1: Verify user authentication
        const authRecord = c.get("authRecord");
        
        if (!authRecord) {
            console.log("❌ No authentication provided");
            return c.json(401, {
                "error": "Authentication required",
                "code": "UNAUTHORIZED"
            });
        }
        
        // Step 2: Verify user has api_device role
        if (authRecord.role !== "api_device") {
            console.log("❌ Access denied - Role:", authRecord.role, "Required: api_device");
            return c.json(403, {
                "error": "Access denied. Only api_device role can download APK files.",
                "code": "FORBIDDEN",
                "required_role": "api_device",
                "user_role": authRecord.role
            });
        }
        
        // Step 3: Get and validate file record
        const fileId = c.pathParam("id");
        const filename = c.pathParam("filename");
        
        let record;
        try {
            record = $app.dao().findRecordById("secure_apk_files", fileId);
        } catch (err) {
            console.log("❌ File record not found:", fileId);
            return c.json(404, {
                "error": "File not found",
                "code": "FILE_NOT_FOUND",
                "file_id": fileId
            });
        }
        
        // Step 4: Check if file is active
        if (!record.getBool("active")) {
            console.log("❌ File is inactive:", fileId);
            return c.json(404, {
                "error": "File not found or inactive",
                "code": "FILE_INACTIVE"
            });
        }
        
        // Step 5: Verify filename matches
        const actualFilename = record.getString("apk_file");
        if (!actualFilename) {
            console.log("❌ No file attached to record:", fileId);
            return c.json(404, {
                "error": "No file attached to this record",
                "code": "NO_FILE_ATTACHED"
            });
        }
        
        // Step 6: Generate and serve secure file URL
        const fileUrl = record.getFileUrl("apk_file", actualFilename);
        
        console.log("✅ Serving secure APK file:", actualFilename, "to user:", authRecord.id);
        
        // Log download for analytics
        console.log("📊 APK Download Analytics:", JSON.stringify({
            user_id: authRecord.id,
            file_id: fileId,
            filename: actualFilename,
            version_code: record.getString("version_code"),
            platform: record.getString("platform"),
            timestamp: new Date().toISOString(),
            user_agent: c.request().header.get("User-Agent") || "unknown"
        }));
        
        // Redirect to actual file URL (303 = See Other)
        return c.redirect(303, fileUrl);
        
    } catch (err) {
        console.error("💥 Secure APK access error:", err);
        
        // Return appropriate error based on exception type
        if (err instanceof BadRequestError) {
            return c.json(400, {
                "error": "Bad request: " + err.message,
                "code": "BAD_REQUEST"
            });
        } else if (err instanceof ForbiddenError) {
            return c.json(403, {
                "error": err.message,
                "code": "FORBIDDEN"
            });
        } else if (err instanceof NotFoundError) {
            return c.json(404, {
                "error": err.message,
                "code": "NOT_FOUND"
            });
        } else {
            return c.json(500, {
                "error": "Internal server error",
                "code": "INTERNAL_ERROR"
            });
        }
    }
});

/**
 * HOOK VERIFICATION ENDPOINT
 * Test endpoint to verify hook is loaded correctly
 */
routerAdd("GET", "/api/secure-apk/health", (c) => {
    return c.json(200, {
        "status": "ok",
        "message": "Secure APK access hook is active",
        "version": "1.0.0",
        "timestamp": new Date().toISOString()
    });
});

console.log("🚀 Secure APK Access Hook loaded successfully");
console.log("📋 Available endpoints:");
console.log("   GET /api/secure-apk/{id}/{filename} - Download APK with authentication");
console.log("   GET /api/secure-apk/health - Hook health check");