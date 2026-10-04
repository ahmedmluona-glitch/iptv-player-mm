package com.example.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

@Composable
fun QrCodeCanvas(
    content: String,
    modifier: Modifier = Modifier,
    sizeDp: Dp = 160.dp,
    qrColor: Color = Color.Black,
    backgroundColor: Color = Color.White
) {
    // Generate deterministic 21x21 QR-like matrix with finder patterns
    val matrix = remember(content) {
        generateQrMatrix(content)
    }

    Box(
        modifier = modifier
            .size(sizeDp)
            .clip(RoundedCornerShape(12.dp))
            .background(backgroundColor),
        contentAlignment = Alignment.Center
    ) {
        Canvas(modifier = Modifier.size(sizeDp - 16.dp)) {
            val n = matrix.size
            val cellSize = this.size.width / n

            for (row in 0 until n) {
                for (col in 0 until n) {
                    if (matrix[row][col]) {
                        drawRect(
                            color = qrColor,
                            topLeft = Offset(col * cellSize, row * cellSize),
                            size = Size(cellSize + 0.5f, cellSize + 0.5f)
                        )
                    }
                }
            }
        }
    }
}

private fun generateQrMatrix(data: String): Array<BooleanArray> {
    val size = 21 // Standard Version 1 QR matrix 21x21
    val matrix = Array(size) { BooleanArray(size) { false } }

    // Helper to draw standard 7x7 Finder Pattern with 1px border and 3x3 inner square
    fun drawFinder(top: Int, left: Int) {
        for (r in 0 until 7) {
            for (c in 0 until 7) {
                val isOuter = r == 0 || r == 6 || c == 0 || c == 6
                val isInner = r in 2..4 && c in 2..4
                matrix[top + r][left + c] = isOuter || isInner
            }
        }
    }

    // Three standard corner finder patterns
    drawFinder(0, 0)
    drawFinder(0, size - 7)
    drawFinder(size - 7, 0)

    // Timing patterns
    for (i in 8 until size - 8) {
        matrix[6][i] = (i % 2 == 0)
        matrix[i][6] = (i % 2 == 0)
    }

    // Deterministic payload encoding using data hash
    val bytes = data.toByteArray(Charsets.UTF_8)
    var byteIdx = 0
    var bitIdx = 0

    for (r in 0 until size) {
        for (c in 0 until size) {
            // Skip the finder patterns and separators
            val inTopLeft = r < 8 && c < 8
            val inTopRight = r < 8 && c >= size - 8
            val inBottomLeft = r >= size - 8 && c < 8
            val inTiming = (r == 6 || c == 6)

            if (!inTopLeft && !inTopRight && !inBottomLeft && !inTiming) {
                val b = if (bytes.isNotEmpty()) bytes[byteIdx % bytes.size].toInt() else 0
                val bit = ((b shr (bitIdx % 8)) and 1) == 1
                // Alternating mask to ensure realistic QR density
                val mask = (r + c) % 2 == 0
                matrix[r][c] = bit xor mask

                bitIdx++
                if (bitIdx % 8 == 0) {
                    byteIdx++
                }
            }
        }
    }

    return matrix
}
