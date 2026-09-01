package com.protocolopep.app

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import java.time.Instant
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter

@CapacitorPlugin(name = "PepHealthConnect")
class PepHealthConnectPlugin : Plugin() {

    companion object {
        private const val HEALTH_CONNECT_PKG = "com.google.android.apps.healthdata"
        private val REQUIRED_PERMISSIONS = setOf(
            HealthPermission.getReadPermission(WeightRecord::class),
            HealthPermission.getWritePermission(WeightRecord::class)
        )
    }

    private fun getHealthClient(): HealthConnectClient? {
        val ctx = context ?: return null
        return try {
            if (HealthConnectClient.getSdkStatus(ctx, HEALTH_CONNECT_PKG) == HealthConnectClient.SDK_AVAILABLE) {
                HealthConnectClient.getOrCreate(ctx)
            } else {
                null
            }
        } catch (e: Exception) {
            null
        }
    }

    @PluginMethod
    fun checkAvailability(call: PluginCall) {
        val ret = JSObject()
        val ctx = context

        if (ctx == null) {
            ret.put("available", false)
            ret.put("status", "UNAVAILABLE")
            ret.put("message", "Contexto Android indisponível.")
            call.resolve(ret)
            return
        }

        try {
            val sdkStatus = HealthConnectClient.getSdkStatus(ctx, HEALTH_CONNECT_PKG)
            when (sdkStatus) {
                HealthConnectClient.SDK_AVAILABLE -> {
                    ret.put("available", true)
                    ret.put("status", "AVAILABLE")
                    ret.put("message", "Health Connect integrado e disponível.")
                }
                HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> {
                    ret.put("available", false)
                    ret.put("status", "UPDATE_REQUIRED")
                    ret.put("message", "O aplicativo Health Connect precisa ser atualizado.")
                }
                else -> {
                    ret.put("available", false)
                    ret.put("status", "UNAVAILABLE")
                    ret.put("message", "Health Connect não está disponível neste dispositivo.")
                }
            }
            call.resolve(ret)
        } catch (e: Exception) {
            ret.put("available", false)
            ret.put("status", "UNAVAILABLE")
            ret.put("message", "Erro ao verificar Health Connect: ${e.message}")
            call.resolve(ret)
        }
    }

    @PluginMethod
    override fun checkPermissions(call: PluginCall) {
        val client = getHealthClient()
        val ret = JSObject()

        if (client == null) {
            ret.put("granted", false)
            ret.put("status", "UNAVAILABLE")
            ret.put("reason", "Health Connect indisponível.")
            call.resolve(ret)
            return
        }

        try {
            runBlocking(Dispatchers.IO) {
                val granted = client.permissionController.getGrantedPermissions()
                val hasAll = REQUIRED_PERMISSIONS.all { it in granted }
                val hasAny = REQUIRED_PERMISSIONS.any { it in granted }

                if (hasAll) {
                    ret.put("granted", true)
                    ret.put("status", "CONNECTED")
                } else if (hasAny) {
                    ret.put("granted", false)
                    ret.put("status", "PARTIALLY_AUTHORIZED")
                } else {
                    ret.put("granted", false)
                    ret.put("status", "NOT_AUTHORIZED")
                }
                call.resolve(ret)
            }
        } catch (e: Exception) {
            ret.put("granted", false)
            ret.put("status", "ERROR")
            ret.put("reason", "Erro ao consultar permissões: ${e.message}")
            call.resolve(ret)
        }
    }

    @PluginMethod
    override fun requestPermissions(call: PluginCall) {
        val client = getHealthClient()
        val ctx = context

        if (client == null || ctx == null) {
            val ret = JSObject().apply {
                put("granted", false)
                put("status", "UNAVAILABLE")
                put("reason", "Health Connect indisponível.")
            }
            call.resolve(ret)
            return
        }

        try {
            var hasAll = false
            runBlocking(Dispatchers.IO) {
                val granted = client.permissionController.getGrantedPermissions()
                hasAll = REQUIRED_PERMISSIONS.all { it in granted }
            }

            if (hasAll) {
                val ret = JSObject().apply {
                    put("granted", true)
                    put("status", "CONNECTED")
                }
                call.resolve(ret)
            } else {
                activity.runOnUiThread {
                    try {
                        val contract = PermissionController.createRequestPermissionResultContract()
                        val intent = contract.createIntent(ctx, REQUIRED_PERMISSIONS)
                        startActivityForResult(call, intent, "healthPermissionsCallback")
                    } catch (e: Exception) {
                        openSettingsInternal()
                        val ret = JSObject().apply {
                            put("granted", false)
                            put("status", "NOT_AUTHORIZED")
                            put("reason", "Permissões pendentes no Health Connect.")
                        }
                        call.resolve(ret)
                    }
                }
            }
        } catch (e: Exception) {
            val ret = JSObject().apply {
                put("granted", false)
                put("status", "ERROR")
                put("reason", "Erro ao verificar permissões: ${e.message}")
            }
            call.resolve(ret)
        }
    }

    @ActivityCallback
    private fun healthPermissionsCallback(call: PluginCall?, @Suppress("UNUSED_PARAMETER") result: ActivityResult) {
        if (call == null) return
        val client = getHealthClient()
        val ret = JSObject()

        if (client == null) {
            ret.put("granted", false)
            ret.put("status", "UNAVAILABLE")
            ret.put("reason", "Health Connect indisponível.")
            call.resolve(ret)
            return
        }

        try {
            runBlocking(Dispatchers.IO) {
                val granted = client.permissionController.getGrantedPermissions()
                val hasAll = REQUIRED_PERMISSIONS.all { it in granted }
                val hasAny = REQUIRED_PERMISSIONS.any { it in granted }

                if (hasAll) {
                    ret.put("granted", true)
                    ret.put("status", "CONNECTED")
                } else if (hasAny) {
                    ret.put("granted", false)
                    ret.put("status", "PARTIALLY_AUTHORIZED")
                } else {
                    ret.put("granted", false)
                    ret.put("status", "NOT_AUTHORIZED")
                }
                call.resolve(ret)
            }
        } catch (e: Exception) {
            ret.put("granted", false)
            ret.put("status", "ERROR")
            ret.put("reason", "Erro ao verificar permissões após autorização: ${e.message}")
            call.resolve(ret)
        }
    }

    @PluginMethod
    fun openSettings(call: PluginCall) {
        val success = openSettingsInternal()
        if (success) {
            call.resolve()
        } else {
            call.reject("Não foi possível abrir as configurações do Health Connect.")
        }
    }

    private fun openSettingsInternal(): Boolean {
        val ctx = context ?: return false
        return try {
            val intent = Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            if (intent.resolveActivity(ctx.packageManager) != null) {
                ctx.startActivity(intent)
                return true
            }

            val playStoreIntent = Intent(
                Intent.ACTION_VIEW,
                Uri.parse("market://details?id=$HEALTH_CONNECT_PKG")
            ).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            if (playStoreIntent.resolveActivity(ctx.packageManager) != null) {
                ctx.startActivity(playStoreIntent)
                return true
            }

            val webIntent = Intent(
                Intent.ACTION_VIEW,
                Uri.parse("https://play.google.com/store/apps/details?id=$HEALTH_CONNECT_PKG")
            ).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            ctx.startActivity(webIntent)
            true
        } catch (e: Exception) {
            false
        }
    }

    @PluginMethod
    fun writeRecords(call: PluginCall) {
        val client = getHealthClient()
        if (client == null) {
            call.reject("Health Connect indisponível para gravação.")
            return
        }

        try {
            val recordsArray = call.getArray("records") ?: JSArray()
            val recordsToInsert = mutableListOf<WeightRecord>()
            val localZone = ZoneId.systemDefault()

            for (i in 0 until recordsArray.length()) {
                val obj = recordsArray.getJSONObject(i) ?: continue
                val weightKg = obj.optDouble("weightKg", obj.optDouble("weight", 0.0))
                if (weightKg <= 0.0) continue

                val dateStr = obj.optString("date", "")
                val timeStr = obj.optString("time", "12:00")
                
                val instant = try {
                    if (obj.has("timestamp") && obj.getString("timestamp").isNotEmpty()) {
                        Instant.parse(obj.getString("timestamp"))
                    } else if (obj.has("time") && obj.getString("time").contains("T")) {
                        Instant.parse(obj.getString("time"))
                    } else if (dateStr.isNotEmpty()) {
                        val safeTime = if (timeStr.length == 5) "$timeStr:00" else timeStr
                        val zdt = ZonedDateTime.parse("${dateStr}T${safeTime}", DateTimeFormatter.ISO_LOCAL_DATE_TIME.withZone(localZone))
                        zdt.toInstant()
                    } else {
                        throw IllegalArgumentException("Data ou timestamp ausente no registro.")
                    }
                } catch (e: Exception) {
                    throw IllegalArgumentException("Timestamp inválido para o registro '${obj.optString("clientRecordId", "")}': ${e.message}")
                }

                // Nunca converte ID local/sintético em clientRecordId: somente a identidade explícita é válida.
                val clientRecordId = obj.optString("clientRecordId", "")
                val clientRecordVersion = if (obj.has("clientRecordVersion")) {
                    obj.optLong("clientRecordVersion", 1L)
                } else if (obj.has("syncVersion")) {
                    obj.optLong("syncVersion", 1L)
                } else {
                    1L
                }

                val weightRecord = PepHealthConnectMapper.createWeightRecord(
                    weightKg = weightKg,
                    timestamp = instant.toString(),
                    clientRecordId = clientRecordId,
                    clientRecordVersion = clientRecordVersion,
                    zoneOffset = obj.optString("zoneOffset", "").ifBlank { null },
                    fallbackZone = localZone
                )
                recordsToInsert.add(weightRecord)
            }

            if (recordsToInsert.isNotEmpty()) {
                runBlocking(Dispatchers.IO) {
                    client.insertRecords(recordsToInsert)
                }
            }

            val ret = JSObject().apply {
                put("success", true)
                put("count", recordsToInsert.size)
            }
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject("Erro ao gravar no Health Connect: ${e.message}")
        }
    }

    @PluginMethod
    fun readRecords(call: PluginCall) {
        val client = getHealthClient()
        if (client == null) {
            val ret = JSObject().apply {
                put("success", false)
                put("error", "HEALTH_CONNECT_UNAVAILABLE")
                put("message", "Health Connect indisponível no dispositivo.")
                put("records", JSArray())
            }
            call.resolve(ret)
            return
        }

        try {
            val startTimeStr = call.getString("startTime")
            val endTimeStr = call.getString("endTime")

            val startInstant = if (!startTimeStr.isNullOrEmpty()) {
                Instant.parse(startTimeStr)
            } else {
                Instant.now().minusSeconds(30L * 24 * 3600)
            }

            val endInstant = if (!endTimeStr.isNullOrEmpty()) {
                Instant.parse(endTimeStr)
            } else {
                Instant.now()
            }

            val resultList = mutableListOf<JSONObject>()
            val localZone = ZoneId.systemDefault()

            runBlocking(Dispatchers.IO) {
                val response = client.readRecords(
                    ReadRecordsRequest(
                        recordType = WeightRecord::class,
                        timeRangeFilter = TimeRangeFilter.between(startInstant, endInstant)
                    )
                )

                for (record in response.records) {
                    val payload = PepHealthConnectMapper.toPayload(record, localZone)

                    val item = JSONObject().apply {
                        put("id", payload.id)
                        put("healthConnectRecordId", payload.healthConnectRecordId)
                        put("clientRecordId", payload.clientRecordId)
                        put("clientRecordVersion", payload.clientRecordVersion)
                        put("lastModifiedTime", payload.lastModifiedTime)
                        put("dataOrigin", payload.dataOrigin)
                        put("zoneOffset", payload.zoneOffset)
                        put("metadataId", payload.id)
                        put("timestamp", payload.timestamp)
                        put("time", payload.timestamp)
                        put("date", payload.date)
                        put("localTime", payload.localTime)
                        put("weight", payload.weightKg)
                        put("weightKg", payload.weightKg)
                        put("unit", "kg")
                        put("source", "health_connect")
                        put("ownership", payload.ownership)
                    }
                    resultList.add(item)
                }
            }

            val jsArray = JSArray()
            resultList.forEach { jsArray.put(it) }

            val ret = JSObject().apply {
                put("success", true)
                put("records", jsArray)
            }
            call.resolve(ret)
        } catch (e: Exception) {
            val ret = JSObject().apply {
                put("success", false)
                put("error", "HEALTH_CONNECT_READ_FAILED")
                put("message", e.message ?: "Erro desconhecido na leitura de registros do Health Connect.")
                put("records", JSArray())
            }
            call.resolve(ret)
        }
    }

    @PluginMethod
    fun deleteRecords(call: PluginCall) {
        val client = getHealthClient()
        if (client == null) {
            call.reject("Health Connect indisponível para exclusão.")
            return
        }

        try {
            val recordIds = call.getArray("recordIds") ?: JSArray()
            val clientRecordIds = call.getArray("clientRecordIds") ?: JSArray()

            val idList = mutableListOf<String>()
            for (i in 0 until recordIds.length()) {
                val id = recordIds.optString(i, "")
                if (id.isNotEmpty()) idList.add(id)
            }

            val clientRecIdList = mutableListOf<String>()
            for (i in 0 until clientRecordIds.length()) {
                val id = clientRecordIds.optString(i, "")
                if (id.isNotEmpty()) clientRecIdList.add(id)
            }

            if (idList.isEmpty() && clientRecIdList.isEmpty()) {
                val ret = JSObject().apply {
                    put("success", true)
                    put("deletedCount", 0)
                }
                call.resolve(ret)
                return
            }

            runBlocking(Dispatchers.IO) {
                client.deleteRecords(
                    recordType = WeightRecord::class,
                    recordIdsList = idList,
                    clientRecordIdsList = clientRecIdList
                )
            }

            val ret = JSObject().apply {
                put("success", true)
                put("deletedCount", idList.size + clientRecIdList.size)
            }
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject("Erro ao deletar registros no Health Connect: ${e.message}")
        }
    }
}
