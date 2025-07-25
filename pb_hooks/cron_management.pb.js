/// Cron Job Management - Centralized cron scheduling
/// Manages all scheduled jobs with proper timing and monitoring

// Weekly device statistics report (Sundays at 1 AM)
cronAdd("weekly_stats", "0 1 * * 0", () => {
    console.log("📊 Running weekly device statistics report...")
    
    try {
        const allDevices = $app.dao().findRecordsByFilter("api_devices", "", "", 1000, 0)
        const activeDevices = allDevices.filter(d => d.get("active") === true)
        const inactiveDevices = allDevices.filter(d => d.get("active") === false)
        
        // Group by fingerprint for duplicate analysis
        const fingerprintGroups = {}
        allDevices.forEach(device => {
            const fp = device.get("device_fingerprint")
            if (fp) {
                if (!fingerprintGroups[fp]) {
                    fingerprintGroups[fp] = []
                }
                fingerprintGroups[fp].push(device)
            }
        })
        
        const duplicateGroups = Object.values(fingerprintGroups).filter(group => group.length > 1)
        
        console.log("📈 WEEKLY DEVICE STATISTICS")
        console.log("===========================")
        console.log(`Total devices: ${allDevices.length}`)
        console.log(`Active devices: ${activeDevices.length}`)
        console.log(`Inactive devices: ${inactiveDevices.length}`)
        console.log(`Unique fingerprints: ${Object.keys(fingerprintGroups).length}`)
        console.log(`Duplicate groups: ${duplicateGroups.length}`)
        
        if (duplicateGroups.length > 0) {
            console.log("⚠️ Active duplicates detected - cleanup may be needed")
        } else {
            console.log("✅ No duplicate groups detected")
        }
        
    } catch (error) {
        console.log(`❌ Error in weekly stats: ${error.message}`)
    }
})

// Monthly cleanup of very old inactive devices (1st of month at 2 AM)
cronAdd("monthly_cleanup", "0 2 1 * *", () => {
    console.log("🗑️ Running monthly cleanup of old inactive devices...")
    
    try {
        // Find inactive devices older than 90 days
        const ninetyDaysAgo = new Date()
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
        
        const oldDevices = $app.dao().findRecordsByFilter(
            "api_devices",
            `active = false && last_activity < {:cutoff}`,
            "",
            100,
            0,
            { "cutoff": ninetyDaysAgo.toISOString() }
        )
        
        console.log(`🔍 Found ${oldDevices.length} inactive devices older than 90 days`)
        
        if (oldDevices.length === 0) {
            console.log("✅ No old devices to clean up")
            return
        }
        
        // Add archive note instead of deleting (for compliance)
        let archivedCount = 0
        for (let device of oldDevices) {
            try {
                const existingNotes = device.get("notes") || ""
                const archiveNote = `Archived by monthly cleanup on ${new Date().toISOString()} (90+ days inactive)`
                device.set("notes", existingNotes ? `${existingNotes}; ${archiveNote}` : archiveNote)
                device.set("session_status", "archived")
                
                $app.dao().saveRecord(device)
                archivedCount++
                
            } catch (deviceError) {
                console.log(`⚠️ Failed to archive device ${device.getId()}: ${deviceError.message}`)
            }
        }
        
        console.log(`✅ Archived ${archivedCount} old inactive devices`)
        
    } catch (error) {
        console.log(`❌ Error in monthly cleanup: ${error.message}`)
    }
})

// Health check job (every 6 hours)
cronAdd("health_check", "0 */6 * * *", () => {
    console.log("🏥 Running system health check...")
    
    try {
        // Check database connectivity
        const deviceCount = $app.dao().findRecordsByFilter("api_devices", "", "", 1, 0).length
        console.log(`✅ Database accessible, found ${deviceCount}+ devices`)
        
        // Check for any critical issues
        const activeDevices = $app.dao().findRecordsByFilter("api_devices", "active = true", "", 100, 0)
        const fingerprintGroups = {}
        
        activeDevices.forEach(device => {
            const fp = device.get("device_fingerprint")
            if (fp) {
                fingerprintGroups[fp] = (fingerprintGroups[fp] || 0) + 1
            }
        })
        
        const criticalDuplicates = Object.values(fingerprintGroups).filter(count => count > 1).length
        
        if (criticalDuplicates > 0) {
            console.log(`⚠️ ALERT: ${criticalDuplicates} active duplicate groups detected`)
        } else {
            console.log("✅ No critical duplicate issues detected")
        }
        
        console.log(`📊 Health Status: ${activeDevices.length} active devices, ${Object.keys(fingerprintGroups).length} unique fingerprints`)
        
    } catch (error) {
        console.log(`❌ Health check failed: ${error.message}`)
    }
})

console.log("⏰ Cron job management initialized")
console.log("📋 Scheduled jobs:")
console.log("   - device_cleanup: Daily at midnight (0 0 * * *)")
console.log("   - weekly_stats: Sundays at 1 AM (0 1 * * 0)")
console.log("   - monthly_cleanup: 1st of month at 2 AM (0 2 1 * *)")
console.log("   - health_check: Every 6 hours (0 */6 * * *)")