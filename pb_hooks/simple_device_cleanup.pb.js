/// Simple Device Cleanup Cron Job - Updated syntax
/// Based on official PocketBase documentation syntax

// Test job that runs every 2 minutes to verify cron functionality
cronAdd("simple_test", "*/2 * * * *", () => {
    console.log("🧪 Simple test cron job running...")
    
    try {
        // Try to access the DAO
        const dao = $app.dao()
        console.log("✅ DAO access successful")
        
        // Try to get device records
        const devices = dao.findRecordsByFilter("api_devices", "", "", 10, 0)
        console.log(`📊 Found ${devices.length} devices`)
        
        if (devices.length === 0) {
            console.log("✅ No devices to process")
            return
        }
        
        // Group by fingerprint for duplicate detection
        const fingerprintMap = {}
        for (let device of devices) {
            const fp = device.get("device_fingerprint")
            if (fp) {
                if (!fingerprintMap[fp]) {
                    fingerprintMap[fp] = []
                }
                fingerprintMap[fp].push(device)
            }
        }
        
        // Check for duplicates
        let duplicateGroups = 0
        for (let fp in fingerprintMap) {
            if (fingerprintMap[fp].length > 1) {
                duplicateGroups++
                console.log(`🚨 Found ${fingerprintMap[fp].length} devices with fingerprint ${fp.substring(0, 12)}...`)
                
                // Sort by last activity (most recent first)
                const deviceGroup = fingerprintMap[fp]
                deviceGroup.sort((a, b) => {
                    const aTime = new Date(a.get("last_activity") || a.get("created") || 0)
                    const bTime = new Date(b.get("last_activity") || b.get("created") || 0)
                    return bTime - aTime
                })
                
                // Keep first (most recent) active, deactivate others
                for (let i = 1; i < deviceGroup.length; i++) {
                    const device = deviceGroup[i]
                    console.log(`🔄 Deactivating duplicate: ${device.getId()}`)
                    
                    device.set("active", false)
                    device.set("session_status", "logged_out")
                    device.set("last_activity", new Date().toISOString())
                    
                    dao.saveRecord(device)
                }
                
                console.log(`✅ Processed fingerprint group: kept 1 active, deactivated ${deviceGroup.length - 1}`)
            }
        }
        
        if (duplicateGroups === 0) {
            console.log("✅ No duplicate devices found")
        } else {
            console.log(`🎉 Cleanup completed: processed ${duplicateGroups} duplicate groups`)
            
            // Remove the test job after successful cleanup
            console.log("🧪 Removing test job after successful cleanup")
            cronRemove("simple_test")
        }
        
    } catch (error) {
        console.log(`❌ Error in simple cleanup job: ${error.message}`)
    }
})

console.log("🧪 Simple device cleanup test job scheduled (every 2 minutes)")
console.log("📋 Job ID: simple_test")
console.log("⏰ Will auto-remove after successful cleanup")