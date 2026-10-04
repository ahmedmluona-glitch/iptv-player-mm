package com.example.ui.screens

import android.view.KeyEvent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.QrCode
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Tv
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.data.subscription.DeviceCodeInfo
import com.example.ui.components.MluonaLogo
import com.example.ui.components.QrCodeCanvas
import com.example.ui.theme.TvAccentEmerald
import com.example.ui.theme.TvAccentGold
import com.example.ui.theme.TvBackground
import com.example.ui.theme.TvBorder
import com.example.ui.theme.TvSurface
import com.example.ui.theme.TvSurfaceHighlight
import com.example.ui.theme.TvTextMuted
import com.example.ui.theme.TvTextPrimary
import com.example.ui.theme.TvTextSecondary
import com.example.ui.viewmodel.IptvViewModel
import kotlinx.coroutines.delay

@Composable
fun DeviceCodeLoginScreen(
    viewModel: IptvViewModel,
    onLoginSuccess: () -> Unit
) {
    var deviceInfo by remember { mutableStateOf<DeviceCodeInfo?>(null) }
    var isPolling by remember { mutableStateOf(false) }
    var countdownSeconds by remember { mutableIntStateOf(600) }
    var showEmailLogin by remember { mutableStateOf(false) }
    var statusMessage by remember { mutableStateOf<String?>(null) }

    // Email login inputs
    var emailInput by remember { mutableStateOf("demo@mluona.com") }
    var passwordInput by remember { mutableStateOf("") }
    var isSubmittingEmail by remember { mutableStateOf(false) }

    val primaryFocusRequester = remember { FocusRequester() }

    // Fetch Device Code initially
    LaunchedEffect(Unit) {
        statusMessage = "جارٍ إنشاء كود الاقتران للتلفاز..."
        val res = viewModel.subscriptionManager.requestDeviceCode()
        res.onSuccess { info ->
            deviceInfo = info
            countdownSeconds = info.expiresInSeconds
            isPolling = true
            statusMessage = "امسح الرمز أو أدخل الكود على الهاتف للاقتران"
        }.onFailure {
            statusMessage = "تعذر الاتصال، يمكنك بدء التجربة المجانية مباشرة"
        }
        delay(200)
        try {
            primaryFocusRequester.requestFocus()
        } catch (_: Exception) {}
    }

    // 16. Poll /v1/device/poll every 3 seconds
    LaunchedEffect(isPolling, deviceInfo?.code) {
        val code = deviceInfo?.code
        if (isPolling && !code.isNullOrBlank()) {
            while (countdownSeconds > 0) {
                delay(3000)
                countdownSeconds -= 3
                val token = viewModel.subscriptionManager.pollDeviceCode(code)
                if (token != null) {
                    statusMessage = "تم الاقتران بنجاح! جارٍ الدخول..."
                    viewModel.onAuthSuccess()
                    onLoginSuccess()
                    break
                }
            }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(TvBackground)
            .padding(32.dp)
            .testTag("device_code_login_screen"),
        contentAlignment = Alignment.Center
    ) {
        Row(
            modifier = Modifier.fillMaxSize(),
            horizontalArrangement = Arrangement.spacedBy(40.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Left Panel: Code & QR Pairing
            Column(
                modifier = Modifier
                    .weight(1.2f)
                    .clip(RoundedCornerShape(24.dp))
                    .background(TvSurface)
                    .border(1.dp, TvBorder, RoundedCornerShape(24.dp))
                    .padding(32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                MluonaLogo()
                Spacer(modifier = Modifier.height(16.dp))

                Text(
                    text = "تسجيل الدخول واقتران التلفاز",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = TvTextPrimary
                )
                Text(
                    text = "افتح الموقع من هاتفك وامسح الرمز أو أدخل الكود التالي:",
                    fontSize = 15.sp,
                    color = TvTextSecondary,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(vertical = 8.dp)
                )

                Spacer(modifier = Modifier.height(16.dp))

                // 6-Character Code Display
                val codeText = deviceInfo?.code ?: "------"
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    codeText.forEach { ch ->
                        Box(
                            modifier = Modifier
                                .size(54.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color(0xFF071F15))
                                .border(2.dp, TvAccentEmerald, RoundedCornerShape(12.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = ch.toString(),
                                fontSize = 28.sp,
                                fontWeight = FontWeight.Black,
                                color = TvAccentEmerald
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Verification URL
                Text(
                    text = deviceInfo?.verificationUrl ?: "https://mluona-iptv.com/pair",
                    fontSize = 13.sp,
                    color = TvAccentGold,
                    fontWeight = FontWeight.SemiBold
                )

                Spacer(modifier = Modifier.height(16.dp))

                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(16.dp),
                        color = TvAccentEmerald,
                        strokeWidth = 2.dp
                    )
                    Text(
                        text = "بانتظار التأكيد على الهاتف... (${countdownSeconds / 60}:${"%02d".format(countdownSeconds % 60)})",
                        fontSize = 13.sp,
                        color = TvTextMuted
                    )
                }

                if (statusMessage != null) {
                    Text(
                        text = statusMessage!!,
                        fontSize = 12.sp,
                        color = TvAccentEmerald,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }
            }

            // Right Panel: QR Code & Alternative Login (Trial / Email)
            Column(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(24.dp))
                    .background(TvSurface)
                    .border(1.dp, TvBorder, RoundedCornerShape(24.dp))
                    .padding(32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) {
                // QR Code
                val qrData = deviceInfo?.qrPayload ?: "https://mluona-iptv.com/pair?code=${deviceInfo?.code ?: "MLTV"}"
                QrCodeCanvas(
                    content = qrData,
                    sizeDp = 160.dp,
                    qrColor = Color(0xFF05170F),
                    backgroundColor = Color.White
                )

                Spacer(modifier = Modifier.height(20.dp))

                // 15. Instant 7-Day Free Trial Button
                TvActionButton(
                    text = "بدء التجربة المجانية 7 أيام فخمة",
                    icon = Icons.Default.Tv,
                    isHighlight = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .focusRequester(primaryFocusRequester),
                    onClick = {
                        statusMessage = "جارٍ تفعيل التجربة المجانية 7 أيام..."
                        viewModel.startTrial(
                            email = "trial-${System.currentTimeMillis() % 10000}@mluona.com",
                            onSuccess = {
                                onLoginSuccess()
                            }
                        )
                    }
                )

                Spacer(modifier = Modifier.height(12.dp))

                // Email Login Toggle
                TvActionButton(
                    text = if (showEmailLogin) "إخفاء الدخول بالبريد" else "الدخول بالبريد الإلكتروني",
                    icon = Icons.Default.Email,
                    isHighlight = false,
                    modifier = Modifier.fillMaxWidth(),
                    onClick = { showEmailLogin = !showEmailLogin }
                )

                AnimatedVisibility(visible = showEmailLogin) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        OutlinedTextField(
                            value = emailInput,
                            onValueChange = { emailInput = it },
                            label = { Text("البريد الإلكتروني", color = TvTextMuted) },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = TvAccentEmerald,
                                unfocusedBorderColor = TvBorder,
                                focusedTextColor = TvTextPrimary,
                                unfocusedTextColor = TvTextPrimary
                            )
                        )

                        OutlinedTextField(
                            value = passwordInput,
                            onValueChange = { passwordInput = it },
                            label = { Text("كلمة المرور (اختياري)", color = TvTextMuted) },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = TvAccentEmerald,
                                unfocusedBorderColor = TvBorder,
                                focusedTextColor = TvTextPrimary,
                                unfocusedTextColor = TvTextPrimary
                            )
                        )

                        TvActionButton(
                            text = if (isSubmittingEmail) "جارٍ التحقق..." else "دخول فوري",
                            icon = Icons.Default.Lock,
                            isHighlight = true,
                            modifier = Modifier.fillMaxWidth(),
                            onClick = {
                                if (emailInput.isNotBlank()) {
                                    isSubmittingEmail = true
                                    viewModel.loginWithEmail(
                                        email = emailInput,
                                        password = passwordInput,
                                        onSuccess = {
                                            isSubmittingEmail = false
                                            onLoginSuccess()
                                        },
                                        onError = { err ->
                                            isSubmittingEmail = false
                                            statusMessage = err
                                        }
                                    )
                                }
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun TvActionButton(
    text: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    isHighlight: Boolean = false,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    val interactionSource = remember { MutableInteractionSource() }
    val isFocused by interactionSource.collectIsFocusedAsState()

    val bg = when {
        isFocused -> if (isHighlight) TvAccentEmerald else TvSurfaceHighlight
        isHighlight -> Color(0xFF0B2E1E)
        else -> Color(0xFF141F29)
    }

    val contentColor = when {
        isFocused && isHighlight -> Color.Black
        isFocused -> TvTextPrimary
        isHighlight -> TvAccentEmerald
        else -> TvTextSecondary
    }

    val borderStroke = when {
        isFocused -> 2.dp
        isHighlight -> 1.dp
        else -> 1.dp
    }

    val borderColor = when {
        isFocused -> if (isHighlight) Color.White else TvAccentEmerald
        isHighlight -> TvAccentEmerald
        else -> TvBorder
    }

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(bg)
            .border(borderStroke, borderColor, RoundedCornerShape(12.dp))
            .focusable(interactionSource = interactionSource)
            .clickable { onClick() }
            .onKeyEvent {
                if (it.nativeKeyEvent.action == KeyEvent.ACTION_DOWN &&
                    (it.nativeKeyEvent.keyCode == KeyEvent.KEYCODE_DPAD_CENTER ||
                     it.nativeKeyEvent.keyCode == KeyEvent.KEYCODE_ENTER)
                ) {
                    onClick()
                    true
                } else false
            }
            .padding(horizontal = 16.dp, vertical = 14.dp),
        contentAlignment = Alignment.Center
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = text,
                tint = contentColor,
                modifier = Modifier.size(20.dp)
            )
            Text(
                text = text,
                color = contentColor,
                fontWeight = FontWeight.Bold,
                fontSize = 15.sp
            )
        }
    }
}
