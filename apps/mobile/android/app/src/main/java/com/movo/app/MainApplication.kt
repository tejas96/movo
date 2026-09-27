package com.movo.app

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.common.assets.ReactFontManager
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    // Android resolves fonts by file name; register the Poppins family so fontFamily + fontWeight work.
    ReactFontManager.getInstance().addCustomFont(this, "Poppins", R.font.poppins)
    createNotificationChannels()
    loadReactNative(this)
  }

  /**
   * Push channels. The API sends channel_id "emergency" for EMERGENCY and "default" for the rest;
   * "default" is also the fallback in firebase.json. Creating an existing channel is a no-op.
   */
  private fun createNotificationChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(NotificationManager::class.java) ?: return
    manager.createNotificationChannels(
      listOf(
        NotificationChannel("default", "Society updates", NotificationManager.IMPORTANCE_DEFAULT),
        NotificationChannel("emergency", "Emergency alerts", NotificationManager.IMPORTANCE_HIGH).apply {
          description = "Alerts raised in your society"
          enableVibration(true)
        },
      ),
    )
  }
}
