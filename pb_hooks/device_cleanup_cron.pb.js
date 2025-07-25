/// Device Cleanup Cron Job - Runs at midnight daily
/// Cleans up duplicate api_devices records and keeps the most recent one
/// Deactivates old duplicates instead of deleting them for audit trail

// Schedule cleanup job to run at midnight every day
cronAdd("device_cleanup", "0 0 * * *", () => {
    console.log("🕛 Starting midnight device cleanup job...")
    
    try {
        // Get all API device records
        const allDevices = $app.dao().findRecordsByFilter(
            "api_devices",
            "",  // No filter - get all devices
            "-last_activity,-last_used,-created",  // Order by most recent activity
            500,  // Limit to reasonable number
            0     // No offset
        )
        
        console.log(`📊 Found ${allDevices.length} total devices to analyze`)
        
        if (allDevices.length === 0) {
            console.log("✅ No devices found, cleanup complete")
            return
        }
        
        // Group devices by fingerprint
        const fingerprintGroups = {}
        let totalDuplicates = 0
        
        for (let device of allDevices) {
            const fingerprint = device.get("device_fingerprint")
            if (!fingerprint) {
                console.log(`⚠️ Device ${device.getId()} has no fingerprint, skipping`)
                continue
            }
            
            if (!fingerprintGroups[fingerprint]) {
                fingerprintGroups[fingerprint] = []
            }
            fingerprintGroups[fingerprint].push(device)
        }
        
        console.log(`🔍 Found ${Object.keys(fingerprintGroups).length} unique device fingerprints`)
        
        // Process each fingerprint group
        for (let fingerprint in fingerprintGroups) {
            const devices = fingerprintGroups[fingerprint]
            
            if (devices.length <= 1) {
                // No duplicates, skip
                continue
            }
            
            console.log(`🚨 Processing ${devices.length} duplicate devices for fingerprint: ${fingerprint.substring(0, 12)}...`)
            totalDuplicates += devices.length - 1  // All but the primary are duplicates
            
            // Sort devices by activity (most recent first)
            devices.sort((a, b) => {
                const aActivity = new Date(a.get("last_activity") || a.get("last_used") || a.get("created") || 0)
                const bActivity = new Date(b.get("last_activity") || b.get("last_used") || b.get("created") || 0)
                return bActivity - aActivity  // Descending order
            })
            
            // First device is the most recent - keep it active
            const primaryDevice = devices[0]
            console.log(`📱 Keeping primary device: ${primaryDevice.getId()} (most recent activity)`)
            
            // Ensure primary device is active
            primaryDevice.set("active", true)
            primaryDevice.set("session_status", primaryDevice.get("current_user_id") ? "active" : "logged_out")
            primaryDevice.set("last_activity", new Date().toISOString())
            $app.dao().saveRecord(primaryDevice)
            
            // Deactivate all other duplicates
            let deactivatedCount = 0
            for (let i = 1; i < devices.length; i++) {
                const duplicateDevice = devices[i]
                
                console.log(`🔄 Deactivating duplicate device: ${duplicateDevice.getId()}`)
                
                // Deactivate but don't delete (for audit trail)
                duplicateDevice.set("active", false)
                duplicateDevice.set("session_status", "logged_out")
                duplicateDevice.set("last_activity", new Date().toISOString())
                duplicateDevice.set("current_user_id", null)
                duplicateDevice.set("current_session_start", null)
                
                // Add cleanup notes for audit
                const existingNotes = duplicateDevice.get("notes") || ""
                const cleanupNote = `Deactivated by cleanup job on ${new Date().toISOString()}`
                duplicateDevice.set("notes", existingNotes ? `${existingNotes}; ${cleanupNote}` : cleanupNote)
                
                $app.dao().saveRecord(duplicateDevice)
                deactivatedCount++
            }
            
            console.log(`✅ Processed fingerprint ${fingerprint.substring(0, 12)}: kept 1 active, deactivated ${deactivatedCount}`)
        }
        
        console.log(`🎉 Device cleanup completed successfully!`)
        console.log(`📊 Summary:`)
        console.log(`   - Total devices analyzed: ${allDevices.length}`)
        console.log(`   - Unique fingerprints: ${Object.keys(fingerprintGroups).length}`)
        console.log(`   - Duplicate devices deactivated: ${totalDuplicates}`)
        console.log(`   - Active devices remaining: ${allDevices.length - totalDuplicates}`)
        
        // Log cleanup statistics to help with monitoring
        console.log(`📈 Cleanup Stats: ${new Date().toISOString()} - Analyzed: ${allDevices.length}, Deactivated: ${totalDuplicates}`)
        
    } catch (error) {
        console.log(`❌ Error during device cleanup: ${error.message}`)
        console.log(`🔄 Cleanup will retry tomorrow at midnight`)
        
        // Don't throw - we want the cron job to continue running
    }
})

console.log("🕛 Device cleanup cron job scheduled for midnight daily (0 0 * * *)")
console.log("📋 Job ID: device_cleanup")
console.log("⏰ Schedule: Every day at 00:00 (midnight)")
console.log("🎯 Purpose: Clean up duplicate api_devices, keep most recent active")