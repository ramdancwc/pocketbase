/// Device Management Hook - Correct PocketBase Syntax
/// Automatically handles device duplicate cleanup server-side
/// Only runs when api_devices are created AND duplicates exist

// Hook for successful device record creation
onRecordAfterCreateSuccess((e) => {
    console.log("🔧 Device creation hook triggered for device:", e.record.getId())
    
    try {
        const newDevice = e.record
        const deviceFingerprint = newDevice.get("device_fingerprint")
        const newUserId = newDevice.get("user_id")
        
        // Early exit if no fingerprint - can't check for duplicates
        if (!deviceFingerprint) {
            console.log("⚠️ No device fingerprint found, skipping duplicate check")
            e.next()
            return
        }
        
        console.log("🔍 Checking for existing devices with fingerprint:", deviceFingerprint.substring(0, 12) + "...")
        
        // Find all devices with the same fingerprint (excluding the newly created one)
        const existingDevices = $app.dao().findRecordsByFilter(
            "api_devices",
            `device_fingerprint = {:fingerprint} && id != {:newId}`,
            "-last_activity,-last_used",
            50,
            0,
            {
                "fingerprint": deviceFingerprint,
                "newId": newDevice.getId()
            }
        )
        
        // Early exit if no duplicates found - this is the normal case
        if (existingDevices.length === 0) {
            console.log("✅ No duplicate devices found - normal device creation")
            e.next()
            return
        }
        
        // Only cleanup if duplicates actually exist
        console.log("⚠️ Found", existingDevices.length, "duplicate device(s), cleaning up...")
        
        // Find the most recently used device among all duplicates
        let primaryDevice = newDevice
        let primaryActivity = newDevice.get("last_used") || newDevice.get("created") || new Date()
        
        for (let device of existingDevices) {
            const deviceActivity = device.get("last_activity") || device.get("last_used") || device.get("created")
            if (new Date(deviceActivity) > new Date(primaryActivity)) {
                primaryDevice = device
                primaryActivity = deviceActivity
            }
        }
        
        // If an existing device is more recent, use it as primary
        if (primaryDevice.getId() !== newDevice.getId()) {
            console.log("📱 Using existing device", primaryDevice.getId(), "as primary, updating with new user:", newUserId)
            
            // Update the existing device with new user info
            primaryDevice.set("user_id", newUserId)
            primaryDevice.set("current_user_id", newUserId)
            primaryDevice.set("last_activity", new Date().toISOString())
            primaryDevice.set("active", true)
            primaryDevice.set("session_status", "active")
            primaryDevice.set("current_session_start", new Date().toISOString())
            
            // Save the updated primary device
            $app.dao().saveRecord(primaryDevice)
            console.log("✅ Updated existing device with new user")
            
            // Delete the newly created duplicate device
            console.log("🗑️ Removing newly created duplicate device:", newDevice.getId())
            $app.dao().deleteRecord(newDevice)
            
        } else {
            // New device is most recent, update it with session info
            console.log("📱 New device is most recent, updating session info")
            
            newDevice.set("current_user_id", newUserId)
            newDevice.set("session_status", "active") 
            newDevice.set("current_session_start", new Date().toISOString())
            newDevice.set("last_activity", new Date().toISOString())
            
            // Save the updated new device
            $app.dao().saveRecord(newDevice)
        }
        
        // Deactivate all other duplicate devices
        const devicesToDeactivate = existingDevices.filter(d => d.getId() !== primaryDevice.getId())
        
        for (let device of devicesToDeactivate) {
            console.log("🔄 Deactivating duplicate device:", device.getId())
            
            device.set("active", false)
            device.set("session_status", "logged_out")
            device.set("last_activity", new Date().toISOString())
            
            $app.dao().saveRecord(device)
        }
        
        console.log("✅ Device duplicate cleanup completed successfully")
        
    } catch (error) {
        console.log("❌ Error in device management hook:", error.message)
        // Continue execution even if cleanup fails - don't break device creation
    }
    
    // Always call e.next() to continue the hook execution chain
    e.next()
    
}, "api_devices") // ONLY triggers on api_devices collection

console.log("🔧 Device management hook loaded successfully")