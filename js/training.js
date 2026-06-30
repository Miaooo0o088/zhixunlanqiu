/**
 * 训练页面逻辑 - 后端版本（带视频缓存功能）
 */
document.addEventListener('DOMContentLoaded', () => {
    // 页面加载时显示训练内容，登录检查推迟到开始训练时进行
    document.getElementById('training-content').style.display = 'block';
    
    // 初始化认证token
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (currentUser && currentUser.token) {
        ApiService.setAuthToken(currentUser.token);
    }
    
    initTrainingStats();
    initTrainingHistory();
    initSocketConnection();
    initCacheControls();
    initCameraControls();
    initAnalysisControls();
    // 创建缓存报告模态框
    createCachedReportModal();
});

/**
 * 全局变量
 */
let cameraStream = null;
let hasPermission = false;
let isTraining = false;
let currentCamera = 'user';
let socket = null;
let frameInterval = null;
let trainingStartTime = null;
let isCaching = false; // 视频缓存状态
let mediaRecorder = null; // 媒体录制器
let recordedChunks = []; // 录制的视频块
let cacheStartTime = null; // 缓存开始时间

// 会话数据（增强版，包含缓存信息）
let sessionData = {
    poses: [],
    processingTimes: [],
    startTime: null,
    type: null,
    videoCache: null, // 缓存的视频数据
    cacheDuration: 0, // 缓存时长（秒）
    cacheSize: 0, // 缓存大小（MB）
    currentReportId: null, // 当前报告ID
    aiAnalysis: null // AI分析结果
};

// 在全局变量部分添加
const SERVER_CONFIG = {
    baseURL: 'http://127.0.0.1:5000/api', // 后端API地址
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json'
    }
};

// 添加用户认证token
let authToken = null;




/**
 * 初始化训练统计数据
 */
function initTrainingStats() {
    // 这里可以添加获取和显示训练统计数据的逻辑
    console.log('初始化训练统计数据');
    
    // 示例：从服务器获取统计数据并更新显示
    fetchTrainingStats().then(stats => {
        if (stats) {
            updateStatsDisplay(stats);
        }
    }).catch(error => {
        console.error('获取训练统计数据失败:', error);
    });
}





/**
 * 初始化缓存控制
 */
function initCacheControls() {
    // 不再需要初始化缓存按钮，因为缓存现在是默认开启的
}

/**
 * 初始化相机控制
 */
function initCameraControls() {
    const toggleCameraBtn = document.getElementById('toggleCamera');
    if (toggleCameraBtn) {
        toggleCameraBtn.addEventListener('click', switchCamera);
    }
}
    
/**
 * 初始化分析控制
 */
function initAnalysisControls() {
    const toggleAnalysisBtn = document.getElementById('toggleAnalysis');
    const aiAnalysisBtn = document.getElementById('aiAnalysisBtn');

    if (toggleAnalysisBtn) {
        toggleAnalysisBtn.addEventListener('click', toggleAnalysis);
    }

    // 注意：aiAnalysisBtn已经在报告窗口中，不在主界面中
    // 我们会在报告窗口显示时绑定事件
}

/**
 * 切换视频缓存功能
 */
function toggleVideoCache() {
    const toggleCacheBtn = document.getElementById('toggleCache');
    
    isCaching = !isCaching;

    if (isCaching) {
        // 开始缓存
        startVideoCache();
        if (toggleCacheBtn) {
            toggleCacheBtn.innerHTML = '<i class="fas fa-video"></i><span>缓存: 开</span>';
            toggleCacheBtn.classList.add('active');
        }

        // 显示缓存指示器
        showCacheIndicator();
    } else {
        // 停止缓存
        stopVideoCache();
        if (toggleCacheBtn) {
            toggleCacheBtn.innerHTML = '<i class="fas fa-video"></i><span>缓存: 关</span>';
            toggleCacheBtn.classList.remove('active');
        }

        // 隐藏缓存指示器
        hideCacheIndicator();
    }
}

/**
 * 切换AI分析功能
 */
function toggleAnalysis() {
    const toggleAnalysisBtn = document.getElementById('toggleAnalysis');
    if (!isTraining) {
        alert('请先开始训练，再开启AI分析');
        return;
    }
    toggleAnalysisBtn.classList.toggle('active');
    // 这里可以添加分析功能的开关逻辑
}

/**
 * 显示缓存指示器
 */
function showCacheIndicator() {
    let indicator = document.getElementById('cacheIndicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'cacheIndicator';
        indicator.className = 'cache-indicator recording';
        indicator.innerHTML = '<i class="fas fa-circle"></i> 录制中';

        const analysisInfo = document.querySelector('.analysis-info');
        if (analysisInfo) {
            analysisInfo.appendChild(indicator);
        }
    }
    indicator.style.display = 'flex';
}

/**
 * 隐藏缓存指示器
 */
function hideCacheIndicator() {
    const indicator = document.getElementById('cacheIndicator');
    if (indicator) {
        indicator.style.display = 'none';
    }
}

/**
 * 开始视频缓存
 */
function startVideoCache() {
    if (!cameraStream) {
        console.error('无法开始缓存：没有可用的相机流');
        return;
    }

    try {
        recordedChunks = [];
        cacheStartTime = Date.now();

        // 配置录制选项 - 使用更兼容的编码格式
        const options = {
            mimeType: 'video/webm;codecs=vp9,opus', // 使用 VP8 替代 VP9
            videoBitsPerSecond: 1500000 // 降低比特率提高兼容性
        };

        // 如果 VP8 不支持，尝试 H.264
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options.mimeType = 'video/mp4;codecs=avc1.42E01E';
        }

        console.log('使用的视频格式:', options.mimeType);

        // 创建媒体录制器
        mediaRecorder = new MediaRecorder(cameraStream, options);

        // 处理数据可用事件
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
                updateCacheStats();
            }
        };

        // 处理停止事件
        mediaRecorder.onstop = () => {
            saveVideoCache();
        };

        // 开始录制，每3秒存储一个片段
        mediaRecorder.start(3000);
        console.log('视频缓存已开始');

    } catch (error) {
        console.error('启动视频缓存失败:', error);
        // 尝试使用默认格式
        try {
            mediaRecorder = new MediaRecorder(cameraStream);
            mediaRecorder.start(3000);
            console.log('使用默认格式开始缓存');
        } catch (fallbackError) {
            console.error('备用方案也失败:', fallbackError);
            alert('视频缓存功能不支持当前浏览器');
        }
    }
}

/**
 * 停止视频缓存
 */
function stopVideoCache() {
    if (mediaRecorder) {
        mediaRecorder.stop();
        console.log('视频缓存已停止');
    }
}

/**
 * 更新缓存按钮状态
 */
function updateCacheButtonState() {
    const toggleCacheBtn = document.getElementById('toggleCache');
    if (toggleCacheBtn) {
        if (isCaching) {
            toggleCacheBtn.innerHTML = '<i class="fas fa-video"></i><span>缓存: 开</span>';
            toggleCacheBtn.classList.add('active');
        } else {
            toggleCacheBtn.innerHTML = '<i class="fas fa-video"></i><span>缓存: 关</span>';
            toggleCacheBtn.classList.remove('active');
        }
    }
}

/**
 * 保存训练数据到服务器
 */
async function saveTrainingDataToServer() {
    try {
        // 1. 先保存基本训练数据
        const sessionId = await saveTrainingSessionToServer();
        
        if (sessionId && sessionData.videoCache) {
            // 2. 如果有视频，上传视频文件
            try {
                await uploadVideoToServer(sessionId);
                console.log('训练数据和视频都已保存到服务器');
            } catch (videoError) {
                console.error('视频上传失败，但训练数据已保存:', videoError);
                // 视频上传失败不影响主要训练数据的保存
            }
        }
        
        // 保存服务器会话ID到本地数据中，便于后续关联
        if (sessionId) {
            sessionData.serverSessionId = sessionId;
        }
        
    } catch (error) {
        console.error('保存到服务器失败，将仅使用本地缓存:', error);
        // 服务器保存失败不影响本地功能
    }
}

/**
 * 结束训练会话 - 修改版本，添加服务器保存
 */
async function endTrainingSession(type) {
    isTraining = false;

    // 停止发送帧
    if (frameInterval) {
        clearInterval(frameInterval);
        frameInterval = null;
    }

    // 停止视频缓存
    if (isCaching) {
        stopVideoCache();
        isCaching = false;
    }

    // 更新缓存按钮状态
    updateCacheButtonState();

    // 隐藏缓存指示器
    hideCacheIndicator();

    // 保存数据到服务器
    await saveTrainingDataToServer();

    // 显示训练总结报告
    showTrainingSummary(type);
    isCaching = false;
}
            
        
    


/**
 * 停止视频缓存
 */
function stopVideoCache() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        console.log('视频缓存已停止');
        // 立即保存视频缓存
        saveVideoCache();
    }
}

/**
 * 保存视频缓存到会话数据
 */
function saveVideoCache() {
    if (recordedChunks.length === 0) {
        console.log('没有视频数据可保存');
        // 即使没有数据也更新状态
        sessionData.videoCache = null;
        sessionData.cacheDuration = 0;
        sessionData.cacheSize = 0;
        return;
    }

    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    const duration = (Date.now() - cacheStartTime) / 1000;

    // 创建对象URL用于回放
    const videoUrl = URL.createObjectURL(blob);

    // 保存到会话数据
    sessionData.videoCache = videoUrl;
    sessionData.cacheDuration = Math.round(duration);
    sessionData.cacheSize = (blob.size / (1024 * 1024)).toFixed(2);

    console.log(`视频缓存已保存: ${sessionData.cacheDuration}秒, ${sessionData.cacheSize}MB`);
}

/**
 * 更新缓存统计信息
 */
function updateCacheStats() {
    const duration = Math.round((Date.now() - cacheStartTime) / 1000);
    const size = (recordedChunks.reduce((total, chunk) => total + chunk.size, 0) / (1024 * 1024)).toFixed(2);

    // 可以在这里实时更新UI显示缓存信息
}

/**
 * 初始化Socket连接
 */
function initSocketConnection() {
    try {
        // 添加更多连接选项以提高连接稳定性
        socket = io('http://127.0.0.1:5000', {
            transports: ['websocket', 'polling'],
            upgrade: true,
            rememberUpgrade: true,
            reconnection: true,
            reconnectionAttempts: 15,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 10000,
            randomizationFactor: 0.5,
            timeout: 30000,
            forceNew: true,
            autoConnect: true
        });

        socket.on('connect', () => {
            console.log('已连接到后端服务器，Socket ID:', socket.id);
            updateConnectionStatus(true);
        });

        socket.on('disconnect', (reason) => {
            console.log('与后端服务器断开连接，原因:', reason);
            updateConnectionStatus(false);
            
            // 如果是服务器主动断开连接或其他网络错误，尝试重连
            if (reason === 'io server disconnect' || reason === 'transport error' || reason === 'ping timeout') {
                console.log('连接异常断开，将在1秒后尝试重新连接...');
                setTimeout(() => {
                    if (socket) {
                        socket.connect();
                    }
                }, 1000);
            }
        });

        socket.on('connect_error', (error) => {
            console.error('连接到服务器时出错:', error);
            console.error('错误详情:', error.message);
            updateConnectionStatus(false);
        });

        socket.on('connect_timeout', () => {
            console.error('连接到服务器超时');
            updateConnectionStatus(false);
        });

        socket.on('error', (error) => {
            console.error('Socket错误:', error);
        });

        socket.on('connected', (data) => {
            console.log('服务器连接确认:', data);
        });

        socket.on('pose_result', (data) => {
            handlePoseResult(data);
        });

        // 新增：AI分析结果事件
        socket.on('ai_analysis_result', (data) => {
            console.log('收到AI分析结果事件:', data);
            // 隐藏分析状态
            const statusElement = document.getElementById('analysisStatus');
            if (statusElement) {
                statusElement.style.display = 'none';
            }
            handleAIAnalysisResult(data);
        });

        socket.on('analysis_started', (data) => {
            console.log('收到分析开始事件:', data);
            showAnalysisStatus('AI分析中，请稍候...');
            
            // 更新报告窗口中的状态文本
            const statusText = document.getElementById('analysisStatusText');
            if (statusText) {
                statusText.textContent = data.message || 'AI分析中，请稍候...';
                statusText.style.color = '#2196F3';
            }
        });

        socket.on('analysis_progress', (data) => {
            console.log('收到分析进度事件:', data);
            
            // 更新报告窗口中的状态文本
            const statusText = document.getElementById('analysisStatusText');
            if (statusText) {
                statusText.textContent = data.message || 'AI分析中，请稍候...';
                statusText.style.color = '#2196F3';
            }
        });

        socket.on('error', (data) => {
            console.error('服务器错误:', data);
            
            // 隐藏分析状态
            const statusElement = document.getElementById('analysisStatus');
            if (statusElement) {
                statusElement.style.display = 'none';
            }
            
            // 更新报告窗口中的状态文本
            const statusText = document.getElementById('analysisStatusText');
            const analyzeBtn = document.getElementById('analyzeTrainingBtn');
            
            if (statusText) {
                statusText.textContent = '服务器错误: ' + (data.message || '未知错误');
                statusText.style.color = '#f44336';
            }
            
            // 恢复分析按钮状态
            if (analyzeBtn) {
                analyzeBtn.disabled = false;
                analyzeBtn.innerHTML = '<i class="fas fa-robot"></i> AI动作分析';
            }
            
            // 显示alert提示（可选）
            // alert('服务器处理错误: ' + data.message);
        });
    } catch (error) {
        console.error('Socket连接初始化失败:', error);
        updateConnectionStatus(false);
    }
}
/**
 * 更新连接状态显示
 */
function updateConnectionStatus(connected) {
    const statusElement = document.querySelector('.analysis-status');
    if (statusElement) {
        if (connected) {
            statusElement.innerHTML = '<i class="fas fa-check-circle"></i><span>已连接到AI服务器</span>';
            statusElement.style.color = '#4CAF50';
        } else {
            statusElement.innerHTML = '<i class="fas fa-exclamation-circle"></i><span>未连接到AI服务器</span>';
            statusElement.style.color = '#f44336';
        }
    }
}

/**
 * 请求相机权限 - 修改为先检查登录状态
 */
function requestCamera(type) {
    // 检查用户是否已登录
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser) {
        // 用户未登录，显示登录提示
        alert('请先登录再开始训练');
        window.location.href = 'auth.html';
        return;
    }
    
    if (hasPermission && cameraStream) {
        startTrainingSession(type);
        return;
    }

    const modal = document.getElementById('cameraModal');
    if (modal) {
        modal.classList.add('active');
        modal.dataset.trainingType = type;
    } else {
        // 如果找不到模态框，直接开始训练
        startTrainingSession(type);
    }
}

/**
 * 切换摄像头
 */
async function switchCamera() {
    if (!cameraStream) return;

    // 停止当前相机流和缓存
    if (isCaching) {
        stopVideoCache();
    }

    cameraStream.getTracks().forEach(track => track.stop());

    // 切换相机方向
    currentCamera = currentCamera === 'user' ? 'environment' : 'user';

    try {
        // 获取新的相机流
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: currentCamera,
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        });

        // 更新视频元素
        const videoElement = document.getElementById('camera');
        videoElement.srcObject = cameraStream;
        await videoElement.play();

        // 更新切换按钮图标
        const toggleBtn = document.getElementById('toggleCamera');
        toggleBtn.innerHTML = `
            <i class="fas fa-${currentCamera === 'user' ? 'camera' : 'camera-rotate'}"></i>
            <span>${currentCamera === 'user' ? '前置' : '后置'}相机</span>
        `;

        // 如果缓存是开启状态，重新开始缓存
        if (isCaching) {
            startVideoCache();
        }

    } catch (err) {
        console.error('切换相机失败:', err);
        alert('切换相机失败，请检查设备是否有多个相机');
    }
}

/**
 * 开始训练
 */
async function startTraining() {
    // 再次检查用户是否已登录（防止在弹窗期间登出）
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser) {
        // 用户未登录，显示登录提示
        alert('请先登录再开始训练');
        window.location.href = 'auth.html';
        return;
    }
    
    const modal = document.getElementById('cameraModal');
    const type = modal.dataset.trainingType;

    try {
        // 请求相机权限
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: currentCamera,
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        });
        hasPermission = true;

        // 将相机流连接到视频元素
        const videoElement = document.getElementById('camera');
        videoElement.srcObject = cameraStream;

        // 等待视频加载完成
        await videoElement.play();

        // 开始训练会话
        startTrainingSession(type);

        // 关闭弹窗
        closeModal();

    } catch (err) {
        console.error('相机访问失败:', err);
        if (err.name === 'NotFoundError') {
            alert('未检测到摄像头设备，请检查设备或使用带摄像头的设备访问。');
        } else {
            alert('无法访问相机，请确保已授予相机权限');
        }
        closeModal();
    }
}

/**
 * 开始训练会话
 */
function startTrainingSession(type) {
    // 检查用户是否已登录
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser) {
        // 用户未登录，显示登录提示
        alert('请先登录再开始训练');
        window.location.href = 'auth.html';
        return;
    }
    
    if (!socket || !socket.connected) {
        alert('未连接到AI服务器，请检查服务器状态');
        return;
    }

    isTraining = true;
    trainingStartTime = Date.now();
    // 初始化缓存相关变量
    recordedChunks = [];
    cacheStartTime = null;
    sessionData = {
        poses: [],
        processingTimes: [],
        startTime: new Date().toISOString(),
        type: type,
        videoCache: null,
        cacheDuration: 0,
        cacheSize: 0,
        currentReportId: null,
        aiAnalysis: null
    };

    const card = document.querySelector(`.training-card[data-type="${type}"]`);
    const startBtn = card.querySelector('.start-btn');

    // 更新按钮状态
    startBtn.innerHTML = `
        <span>
            <i class="fas fa-stop"></i>
            结束训练
        </span>
    `;
    startBtn.classList.add('training-active');
    startBtn.onclick = () => endTrainingSession(type);

    // 显示相机视图
    const videoContainer = document.querySelector('.video-container');
    videoContainer.style.display = 'flex';
    videoContainer.scrollIntoView({ behavior: 'smooth' });

    // 显示视频，隐藏处理后的图像（初始状态）
    const videoElement = document.getElementById('camera');
    const processedImage = document.getElementById('processed-image');
    videoElement.style.display = 'block';
    processedImage.style.display = 'none';

    // 默认开启视频缓存
    isCaching = true;
    startVideoCache();
    updateCacheButtonState();

    // 显示缓存指示器
    showCacheIndicator();

    // 开始发送视频帧
    startSendingFrames();
}

/**
 * 开始发送视频帧到后端
 */
function startSendingFrames() {
    const videoElement = document.getElementById('camera');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    frameInterval = setInterval(() => {
        if (!isTraining || !socket.connected) return;

        try {
            // 设置画布尺寸与视频一致
            canvas.width = videoElement.videoWidth;
            canvas.height = videoElement.videoHeight;

            // 绘制当前视频帧到画布
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

            // 将画布内容转换为base64
            const imageData = canvas.toDataURL('image/jpeg', 0.7);

            // 发送到后端处理，包含训练类型参数
            socket.emit('process_frame', { 
                image: imageData,
                training_type: sessionData.type
            });

        } catch (error) {
            console.error('发送帧数据错误:', error);
        }
    }, 100); // 每100ms发送一帧
}

/**
 * 处理姿势识别结果
 */
function handlePoseResult(data) {
    if (!isTraining) return;

    // 更新姿势名称
    const poseNameElement = document.getElementById('pose-name');
    const processingTimeElement = document.getElementById('processing-time');
    const feedbackElement = document.getElementById('feedback-text');
    const processedImage = document.getElementById('processed-image');

    if (poseNameElement) poseNameElement.textContent = data.pose_name;
    if (processingTimeElement) processingTimeElement.textContent = `${(data.processing_time * 1000).toFixed(1)} ms`;
    if (feedbackElement) feedbackElement.textContent = getFeedbackForPose(data.pose_name);
    if (processedImage && data.processed_image) {
        processedImage.src = data.processed_image;
        // 显示处理后的图像，隐藏原始视频
        const videoElement = document.getElementById('camera');
        videoElement.style.display = 'none';
        processedImage.style.display = 'block';
    }

    // 记录会话数据
    sessionData.poses.push(data.pose_name);
    sessionData.processingTimes.push(data.processing_time);
}

/**
 * 根据姿势名称获取反馈
 */
function getFeedbackForPose(poseName) {
    const feedbackMap = {
        '双手投篮': '投篮姿势标准，继续保持！',
        '防守姿势': '防守姿势正确，注意重心稳定',
        '运球姿势': '运球姿势良好，保持低重心',
        '未知动作': '请做出标准篮球动作',
        '未检测到姿势': '请确保全身在画面中'
    };
    return feedbackMap[poseName] || '动作识别中...';
}

/**
 * 结束训练会话
 */
function endTrainingSession(type) {
    isTraining = false;

    // 停止发送帧
    if (frameInterval) {
        clearInterval(frameInterval);
        frameInterval = null;
    }

    // 停止视频缓存
    if (isCaching) {
        stopVideoCache();
        isCaching = false;
    }

    // 更新缓存按钮状态
    updateCacheButtonState();

    // 隐藏缓存指示器
    hideCacheIndicator();

    // 显示训练总结报告
    showTrainingSummary(type);
}

/**
 * 显示训练总结报告
 */
function showTrainingSummary(type) {
    const modal = document.getElementById('reportModal');
    if (!modal) return;

    // 计算统计数据
    const poseCounts = {};
    sessionData.poses.forEach(pose => {
        poseCounts[pose] = (poseCounts[pose] || 0) + 1;
    });

    const totalPoses = sessionData.poses.length;
    const avgProcessingTime = sessionData.processingTimes.length > 0
        ? (sessionData.processingTimes.reduce((a, b) => a + b, 0) / sessionData.processingTimes.length * 1000).toFixed(1)
        : 0;

    const duration = calculateTrainingDuration();

    // 更新报告内容
    document.getElementById('report-pose-count').textContent = `${totalPoses} 次`;
    document.getElementById('report-duration').textContent = duration;
    document.getElementById('report-avg-processing-time').textContent = `${avgProcessingTime} ms`;

    // 更新缓存状态
    const cacheStatus = sessionData.videoCache ?
        `${sessionData.cacheDuration}秒 / ${sessionData.cacheSize}MB` : '未缓存';
    document.getElementById('report-cache-status').textContent = cacheStatus;

    // 生成教练建议
    const coachTip = generateCoachTip(poseCounts, type);
    document.getElementById('report-coach-tip').textContent = coachTip;

    // 如果有AI分析结果，使用AI分析结果替换教练建议
    let aiAnalysisText = null;
    if (sessionData.aiAnalysis) {
        if (typeof sessionData.aiAnalysis === 'string') {
            aiAnalysisText = sessionData.aiAnalysis;
        } else if (sessionData.aiAnalysis && typeof sessionData.aiAnalysis === 'object') {
            // 尝试从常见字段获取
            aiAnalysisText = sessionData.aiAnalysis.analysis || 
                           sessionData.aiAnalysis.message || 
                           sessionData.aiAnalysis.result || 
                           sessionData.aiAnalysis.advice || 
                           sessionData.aiAnalysis.suggestion ||
                           JSON.stringify(sessionData.aiAnalysis, null, 2);
        }
        
        // 格式化AI分析结果并更新显示
        const formattedAnalysis = formatAnalysisText(aiAnalysisText);
        const coachTipElement = document.getElementById('report-coach-tip');
        if (coachTipElement) {
            if (/<[a-z][\s\S]*>/i.test(formattedAnalysis)) {
                coachTipElement.innerHTML = formattedAnalysis;
            } else {
                coachTipElement.textContent = formattedAnalysis;
            }
        }
    }

    // 如果有缓存视频，显示AI分析按钮和回放按钮
    const replayBtn = document.getElementById('replayBtn');
    const replayControls = document.getElementById('replayControls');
    const aiAnalysisSection = document.getElementById('aiAnalysisSection');

    if (sessionData.videoCache) {
        replayBtn.style.display = 'inline-block';
        replayControls.style.display = 'block';
        aiAnalysisSection.style.display = 'block';

        // 设置回放按钮事件
        replayBtn.onclick = () => showReplayModal();

        // 设置AI分析按钮事件
        const analyzeBtn = document.getElementById('analyzeTrainingBtn');
        if (analyzeBtn) {
            analyzeBtn.onclick = performAIAnalysis;
        }

        // 初始化回放控制
        initReplayControls();
    } else {
        replayBtn.style.display = 'none';
        replayControls.style.display = 'none';
        aiAnalysisSection.style.display = 'none';
    }

    // 显示模态框
    modal.classList.add('active');

    // 自动缓存报告到本地（包含AI分析结果）
    cacheReportLocally(type, {
        poseCounts,
        totalPoses,
        avgProcessingTime,
        duration,
        cacheStatus,
        coachTip: aiAnalysisText || coachTip,
        timestamp: new Date().toISOString(),
        videoCache: !!sessionData.videoCache,
        analysis: aiAnalysisText
    });

    // 设置保存按钮事件
    const saveBtn = document.getElementById('saveReportBtn');
    saveBtn.onclick = () => {
        modal.classList.remove('active');
        finalizeTrainingSession(type);
    };
}

/**
 * 初始化回放控制
 */
function initReplayControls() {
    const progressBar = document.getElementById('replayProgress');
    if (progressBar) {
        progressBar.addEventListener('input', function() {
            const duration = sessionData.cacheDuration;
            const currentTime = (this.value / 100) * duration;
            document.getElementById('replay-time').textContent = formatTime(currentTime);
        });
    }

    // 设置回放时长显示
    document.getElementById('replay-duration').textContent = formatTime(sessionData.cacheDuration);
}

/**
 * 格式化时间显示
 */
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 显示回放模态框
 */
function showReplayModal() {
    const modal = document.getElementById('replayModal');
    const videoElement = document.getElementById('replayVideo');
    const replayInfo = document.getElementById('replayInfo');

    if (sessionData.videoCache) {
        videoElement.src = sessionData.videoCache;
        replayInfo.textContent = `回放视频: ${sessionData.cacheDuration}秒, ${sessionData.cacheSize}MB`;

        videoElement.onloadeddata = () => {
            replayInfo.textContent = `回放视频已加载: ${sessionData.cacheDuration}秒`;
        };

        modal.classList.add('active');
    }
}

/**
 * 关闭回放模态框
 */
function closeReplayModal() {
    const modal = document.getElementById('replayModal');
    const videoElement = document.getElementById('replayVideo');

    // 暂停视频
    videoElement.pause();
    videoElement.currentTime = 0;

    modal.classList.remove('active');
}

/**
 * 回放控制函数
 */
function playReplay() {
    const videoElement = document.getElementById('replayVideo');
    if (videoElement) {
        videoElement.play();
    }
}

function pauseReplay() {
    const videoElement = document.getElementById('replayVideo');
    if (videoElement) {
        videoElement.pause();
    }
}

function stopReplay() {
    const videoElement = document.getElementById('replayVideo');
    if (videoElement) {
        videoElement.pause();
        videoElement.currentTime = 0;
    }
}

/**
 * 生成教练建议
 */
function generateCoachTip(poseCounts, type) {
    const mainPose = Object.keys(poseCounts).reduce((a, b) => poseCounts[a] > poseCounts[b] ? a : b, '未知动作');

    if (type === 'shooting') {
        if (mainPose === '双手投篮') {
            return '投篮姿势非常标准！建议加强腿部发力协调性。';
        } else {
            return '检测到非投篮动作较多，请专注于投篮姿势练习。';
        }
    } else if (type === 'dribbling') {
        if (mainPose === '运球姿势') {
            return '运球姿势良好，建议练习变向和加速运球。';
        } else {
            return '请保持低重心运球姿势，加强球感训练。';
        }
    }

    return '继续坚持训练，动作会越来越标准！';
}

/**
 * 最终化训练会话
 */
function finalizeTrainingSession(type) {
    const card = document.querySelector(`.training-card[data-type="${type}"]`);
    const startBtn = card.querySelector('.start-btn');

    // 恢复按钮状态
    startBtn.innerHTML = `<span><i class="fas fa-play"></i> 开始训练</span>`;
    startBtn.classList.remove('training-active');
    startBtn.onclick = () => requestCamera(type);

    // 显示视频，隐藏处理后的图像
    const videoElement = document.getElementById('camera');
    const processedImage = document.getElementById('processed-image');
    if (videoElement) videoElement.style.display = 'block';
    if (processedImage) processedImage.style.display = 'none';

    // 隐藏视频容器
    const videoContainer = document.querySelector('.video-container');
    if (videoContainer) videoContainer.style.display = 'none';

    // 停止相机流
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => {
            try {
                track.stop();
            } catch (e) {
                console.warn('停止相机轨道时出错:', e);
            }
        });
        cameraStream = null;
    }

    // 清理视频缓存URL
    if (sessionData.videoCache) {
        try {
            URL.revokeObjectURL(sessionData.videoCache);
            sessionData.videoCache = null;
        } catch (e) {
            console.warn('释放视频缓存URL时出错:', e);
        }
    }

    hasPermission = false;
    isTraining = false;
    isCaching = false;

    // 重置缓存相关变量
    recordedChunks = [];
    cacheStartTime = null;
    mediaRecorder = null;

    // 保存训练记录
    saveTrainingRecord(type);
}

/**
 * 关闭相机权限提示
 */
function closeModal() {
    const modal = document.getElementById('cameraModal');
    modal.classList.remove('active');
}

/**
 * 计算训练时长
 */
function calculateTrainingDuration() {
    if (!trainingStartTime) return '0秒';

    const durationInSeconds = Math.round((Date.now() - trainingStartTime) / 1000);
    if (durationInSeconds < 60) {
        return `${durationInSeconds}秒`;
    }

    const minutes = Math.floor(durationInSeconds / 60);
    const seconds = durationInSeconds % 60;
    return `${minutes}分钟 ${seconds}秒`;
}

/**
 * 保存训练记录
 */
function saveTrainingRecord(type) {
    const poseCounts = sessionData.poses.reduce((acc, pose) => {
        acc[pose] = (acc[pose] || 0) + 1;
        return acc;
    }, {});

    const mainPose = Object.keys(poseCounts).reduce((a, b) =>
        poseCounts[a] > poseCounts[b] ? a : b, '未知动作'
    );

    const record = {
        type: type,
        date: new Date().toISOString(),
        duration: calculateTrainingDuration(),
        poseCount: sessionData.poses.length,
        mainPose: mainPose,
        hasVideo: !!sessionData.videoCache,
        cacheDuration: sessionData.cacheDuration,
        cacheSize: sessionData.cacheSize
    };

    // 如果有视频缓存，则自动进行AI分析
    if (sessionData.videoCache && socket && socket.connected) {
        // 延迟一点执行分析，确保训练会话完全结束
        setTimeout(() => {
            sendVideoForAnalysis();
        }, 500);
    }

    // 注意：训练记录现在通过缓存报告方式保存数据，不直接保存到trainingHistory
    console.log('训练记录已生成，将通过缓存报告方式保存');
}

/**
 * 缓存报告到本地存储
 */
function cacheReportLocally(type, reportData) {
    try {
        // 获取当前登录用户
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (!currentUser) {
            console.error('无法获取当前用户信息，无法保存训练记录');
            return;
        }
        
        // 构建用户特定的存储键
        const userSpecificKey = `cachedTrainingReports_${currentUser.username}`;
        const userTypeSpecificKey = `cachedTrainingReports_${currentUser.username}_${type}`;
        
        // 从localStorage获取当前用户的缓存报告
        const cachedReports = JSON.parse(localStorage.getItem(userSpecificKey)) || [];
        
        // 为当前报告生成唯一ID
        const reportId = Date.now();
        
        // 记录ID到sessionData中，以便后续AI分析结果能正确关联
        sessionData.currentReportId = reportId;
        
        // 创建新的报告对象，添加用户标识
        const newReport = {
            id: reportId,
            userId: currentUser.id,
            username: currentUser.username,
            type: type,
            data: reportData,
            cachedAt: new Date().toISOString()
        };
        
        // 将新报告添加到数组开头
        cachedReports.unshift(newReport);
        
        // 限制缓存报告数量，只保留最近的20个报告
        if (cachedReports.length > 20) {
            cachedReports.splice(20);
        }
        
        // 保存到localStorage（用户特定的键）
        localStorage.setItem(userSpecificKey, JSON.stringify(cachedReports));
        
        // 同时保存到类型特定的存储位置
        const typeSpecificReports = JSON.parse(localStorage.getItem(userTypeSpecificKey)) || [];
        typeSpecificReports.unshift({...newReport});
        if (typeSpecificReports.length > 10) {
            typeSpecificReports.splice(10);
        }
        localStorage.setItem(userTypeSpecificKey, JSON.stringify(typeSpecificReports));
        
        // 更新存储统计信息
        const storageStats = JSON.parse(localStorage.getItem('trainingStorageStats')) || {
            totalReports: 0,
            totalShooting: 0,
            totalDribbling: 0,
            lastReportTime: null
        };
        
        storageStats.totalReports++;
        if (type === 'shooting') {
            storageStats.totalShooting++;
        } else if (type === 'dribbling') {
            storageStats.totalDribbling++;
        }
        storageStats.lastReportTime = new Date().toISOString();
        
        localStorage.setItem('trainingStorageStats', JSON.stringify(storageStats));
        
        console.log('训练报告已缓存到本地，报告ID:', reportId, '位置:', 0);
        console.log('存储统计信息:', storageStats);
        
        // 重新加载训练历史记录以显示新缓存的报告
        initTrainingHistory();
    } catch (error) {
        console.error('缓存报告到本地时出错:', error);
    }
}

/**
 * 查看缓存的报告详情
 */
function viewCachedReport(reportId) {
    // 确保ID类型一致，都转换为数字进行比较
    const targetId = Number(reportId);
    const cachedReports = loadCachedReports();
    const report = cachedReports.find(r => Number(r.id) === targetId);
    
    if (!report) {
        alert('未找到该报告');
        return;
    }
    
    // 将当前查看的报告ID记录到sessionData中
    sessionData.currentReportId = targetId;
    
    // 显示报告详情模态框
    showCachedReportModal(report);
}

/**
 * 添加记录到历史列表 - 修改版本，支持服务器记录
 */
function addRecordToHistory(record) {
    const recordsList = document.querySelector('.training-records');
    if (!recordsList) return;
    
    const recordElement = document.createElement('div');
    recordElement.className = 'record-item';
    
    // 设置数据属性
    if (record.isCachedReport) {
        recordElement.setAttribute('data-cached-report-id', record.id);
    } else if (record.isServerRecord) {
        recordElement.setAttribute('data-server-record-id', record.id);
    }
    
    // 格式化缓存状态显示
    let cacheStatus = '';
    if (record.isServerRecord) {
        cacheStatus = record.hasVideo ? 
            `<span class="cache-status server-cached"><i class="fas fa-cloud"></i> 云端</span>` : 
            `<span class="cache-status server-only"><i class="fas fa-cloud"></i> 云端</span>`;
    } else {
        cacheStatus = record.hasVideo || record.data?.videoCache ? 
            `<span class="cache-status cached"><i class="fas fa-check-circle"></i> 已缓存</span>` : 
            `<span class="cache-status not-cached"><i class="fas fa-times-circle"></i> 未缓存</span>`;
    }
    
    // 格式化训练类型显示
    const typeName = record.typeName || (record.type === 'shooting' ? '投篮训练' : '运球训练');
    
    recordElement.innerHTML = `
        <div class="record-header">
            <h4>${typeName}</h4>
            <span class="record-date">${new Date(record.date).toLocaleString()}</span>
        </div>
        <div class="record-content">
            <div class="record-details">
                <div class="detail-item">
                    <span class="label">时长</span>
                    <span class="value">${record.duration}</span>
                </div>
                <div class="detail-item">
                    <span class="label">姿势数</span>
                    <span class="value">${record.poseCount || record.data?.totalPoses || 0}</span>
                </div>
                <div class="detail-item">
                    <span class="label">存储位置</span>
                    <span class="value">${cacheStatus}</span>
                </div>
            </div>
            <div class="record-actions">
                ${record.isCachedReport ? 
                    `<button class="btn btn-secondary" onclick="viewCachedReport('${record.id}')">查看详情</button>` :
                record.isServerRecord ?
                    `<button class="btn btn-secondary" onclick="viewServerRecord('${record.id}')">查看详情</button>` :
                    '<button class="btn btn-secondary" onclick="viewLocalRecord()">查看详情</button>'}
            </div>
        </div>
    `;
    
    // 按时间倒序插入记录，最新的在最上面
    const recordDate = new Date(record.date).getTime();
    let inserted = false;
    
    // 遍历现有的记录，找到合适的插入位置
    for (let i = 0; i < recordsList.children.length; i++) {
        const child = recordsList.children[i];
        const childDate = new Date(child.querySelector('.record-date').textContent).getTime();
        
        // 如果新记录的时间比当前遍历到的记录时间晚，则插入到它前面
        if (recordDate > childDate) {
            recordsList.insertBefore(recordElement, child);
            inserted = true;
            break;
        }
    }
    
    // 如果没有找到合适的位置（即新记录是最旧的），则添加到末尾
    if (!inserted) {
        recordsList.appendChild(recordElement);
    }
}

/**
 * 从服务器获取训练历史记录
 */
async function fetchTrainingHistoryFromServer() {
    try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (!currentUser) {
            return [];
        }

        const response = await ApiService.request('/training/history');
        return response.sessions || [];

    } catch (error) {
        console.error('从服务器获取训练历史失败:', error);
        return [];
    }
}

/**
 * 初始化训练历史记录 - 修改版本，合并服务器和本地数据
 */
async function initTrainingHistory() {
    try {
        // 获取当前登录用户
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (!currentUser) {
            const recordsList = document.querySelector('.training-records');
            if (recordsList) {
                recordsList.innerHTML = '<p>请登录以查看训练记录</p>';
            }
            return;
        }

        // 获取服务器历史记录
        const serverRecords = await fetchTrainingHistoryFromServer();
        
        // 获取本地缓存的报告
        const cachedReports = loadCachedReports();
        
        // 处理服务器记录格式
        const formattedServerRecords = serverRecords.map(record => ({
            id: `server_${record.id}`,
            type: record.trainingType,
            typeName: record.trainingType === 'shooting' ? '投篮训练' : '运球训练',
            date: record.startTime,
            duration: record.duration,
            poseCount: record.poseData?.totalPoses || 0,
            hasVideo: !!record.hasVideo,
            isServerRecord: true,
            serverData: record,
            cachedAt: record.startTime
        }));

        // 处理缓存报告数据
        const formattedCachedReports = cachedReports.map(report => ({
            id: report.id,
            type: report.type,
            typeName: report.type === 'shooting' ? '投篮训练' : '运球训练',
            date: report.cachedAt,
            duration: report.data.duration || '--',
            poseCount: report.data.totalPoses || 0,
            hasVideo: report.data.videoCache,
            isCachedReport: true,
            cachedAt: report.cachedAt,
            avgProcessingTime: report.data.avgProcessingTime || null,
            data: report.data
        }));

        // 合并所有记录
        const allRecords = [...formattedServerRecords, ...formattedCachedReports];
        
        // 按日期排序，最新的在前面
        allRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        const recordsList = document.querySelector('.training-records');
        if (recordsList) {
            recordsList.innerHTML = '';
            allRecords.forEach(record => {
                addRecordToHistory(record);
            });
        }
    } catch (error) {
        console.error('获取训练历史记录失败:', error);
    }
}

/**
 * 更新统计显示
 */
const updateStatsDisplay = (stats) => {
    if (!stats) return;
    // 可以在这里添加统计数据显示逻辑
};

/**
 * 模拟API函数
 */
async function fetchTrainingStats() {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                totalTime: 3600,
                shootingAccuracy: 70,
                trainingDays: 30,
                caloriesBurned: 8000
            });
        }, 800);
    });
}

async function fetchTrainingHistory() {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve([
                {
                    type: 'shooting',
                    date: new Date(Date.now() - 86400000).toISOString(),
                    duration: '30分钟',
                    poseCount: 150,
                    mainPose: '双手投篮',
                    hasVideo: false
                }
            ]);
        }, 1200);
    });
}

/**
 * 执行AI分析
 */
function performAIAnalysis() {


    console.log('开始执行AI分析');
    
    const analyzeBtn = document.getElementById('analyzeTrainingBtn');
    const statusText = document.getElementById('analysisStatusText');
    
    // 检查必要元素
    if (!analyzeBtn) {
        console.error('未找到分析按钮元素');
        alert('界面错误：未找到分析按钮');
        return;
    }
    
    if (!statusText) {
        console.error('未找到状态文本元素');
        alert('界面错误：未找到状态显示区域');
        return;
    }
    
    // 禁用按钮并显示加载状态
    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 分析中...';
    statusText.textContent = '正在准备视频数据...';
    statusText.style.color = '#666';
    
    // 添加超时机制
    let analysisTimeout = setTimeout(() => {
        statusText.textContent = '分析超时，请重试';
        statusText.style.color = '#f44336';
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = '<i class="fas fa-robot"></i> AI动作分析';
        alert('分析超时，请检查网络连接后重试');
    }, 60000); // 60秒超时
    
    console.log('当前sessionData状态:', {
        hasVideoCache: !!sessionData.videoCache,
        videoCache: sessionData.videoCache,
        poses: sessionData.poses,
        type: sessionData.type,
        cacheDuration: sessionData.cacheDuration,
        currentReportId: sessionData.currentReportId
    });
    
    // 检查是否有视频缓存
    if (!sessionData.videoCache) {
        const errorMsg = '没有视频缓存，无法进行分析';
        console.error(errorMsg);
        statusText.textContent = errorMsg;
        statusText.style.color = '#f44336';
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = '<i class="fas fa-robot"></i> AI动作分析';
        alert('错误：' + errorMsg);
        clearTimeout(analysisTimeout);
        return;
    }

    // 检查WebSocket连接
    if (!socket || !socket.connected) {
        const errorMsg = '未连接到服务器，无法进行分析';
        console.error(errorMsg, socket ? socket.connected : 'socket未初始化');
        statusText.textContent = errorMsg;
        statusText.style.color = '#f44336';
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = '<i class="fas fa-robot"></i> AI动作分析';
        alert('错误：' + errorMsg);
        clearTimeout(analysisTimeout);
        return;
    }

    // 调用后端AI分析功能
    sendVideoForAnalysisToBackend((success, message) => {
        console.log('分析回调结果:', success, message);
        // 清除超时定时器
        clearTimeout(analysisTimeout);
        
        // 注意：分析结果将通过socket事件返回，不需要在这里恢复按钮状态
        if (!success) {
            statusText.textContent = '分析请求失败: ' + message;
            statusText.style.color = '#f44336';
            analyzeBtn.disabled = false;
            analyzeBtn.innerHTML = '<i class="fas fa-robot"></i> AI动作分析';
            alert('分析请求失败: ' + message);
        } else {
            statusText.textContent = '分析请求已发送，请等待分析结果...';
            statusText.style.color = '#2196F3';
        }
    });
}

/**
 * 发送视频数据给后端进行AI分析
 */
function sendVideoForAnalysisToBackend(callback) {
    if (!sessionData.videoCache) {
        console.error('AI分析错误: 没有视频缓存');
        callback(false, '没有视频缓存');
        return;
    }

    if (!socket || !socket.connected) {
        console.error('AI分析错误: 未连接到服务器');
        callback(false, '未连接到服务器');
        return;
    }

    showAnalysisStatus('准备视频数据...');

    try {
        console.log('开始获取视频数据，URL:', sessionData.videoCache);
        
        // 直接使用Blob URL获取视频数据
        fetch(sessionData.videoCache)
            .then(response => {
                console.log('获取视频数据响应:', response.status, response.statusText);
                if (!response.ok) {
                    throw new Error(`HTTP错误: ${response.status} ${response.statusText}`);
                }
                return response.blob();
            })
            .then(blob => {
                console.log('视频数据获取成功，大小:', blob.size, '类型:', blob.type);
                
                // 检查文件大小
                if (blob.size > 50 * 1024 * 1024) { // 50MB限制
                    throw new Error('视频文件过大 (' + (blob.size / (1024 * 1024)).toFixed(2) + 'MB)，请缩短训练时间');
                }

                const reader = new FileReader();
                reader.onload = function() {
                    try {
                        const result = reader.result;
                        // 检查数据URL格式
                        if (typeof result !== 'string' || !result.startsWith('data:')) {
                            throw new Error('视频数据格式错误');
                        }
                        
                        const videoBase64 = result.split(',')[1];
                        if (!videoBase64) {
                            throw new Error('无法提取视频Base64数据');
                        }

                        console.log('视频Base64数据长度:', videoBase64.length);

                        // 准备姿势数据
                        const poseData = {
                            'main_pose': '未知',
                            'pose_counts': {},
                            'training_type': sessionData.type,
                            'duration': sessionData.cacheDuration
                        };

                        // 统计姿势数据
                        if (sessionData.poses && sessionData.poses.length > 0) {
                            const poseCounts = sessionData.poses.reduce((acc, pose) => {
                                acc[pose] = (acc[pose] || 0) + 1;
                                return acc;
                            }, {});
                            poseData.pose_counts = poseCounts;
                            poseData.main_pose = Object.keys(poseCounts).reduce((a, b) =>
                                poseCounts[a] > poseCounts[b] ? a : b, '未知动作'
                            );
                        }

                        console.log('发送AI分析请求到后端...', {
                            videoSize: blob.size,
                            poseCount: sessionData.poses ? sessionData.poses.length : 0,
                            poseData: poseData
                        });

                        // 发送分析请求到后端，同时传递报告ID
                        socket.emit('analyze_video', {
                            video_data: videoBase64,
                            pose_data: poseData,
                            video_format: 'webm',
                            report_id: sessionData.currentReportId // 传递报告ID
                        });

                        showAnalysisStatus('视频数据已发送，等待分析...');
                        console.log('视频数据已发送到后端');
                        
                        // 成功发送请求
                        callback(true, '视频数据已发送');
                    } catch (error) {
                        console.error('处理视频数据错误:', error);
                        throw error;
                    }
                };

                reader.onerror = function(error) {
                    console.error('文件读取错误:', error);
                    throw new Error(`视频读取失败: ${error.message || '未知错误'}`);
                };

                reader.onabort = function() {
                    console.error('文件读取被中止');
                    throw new Error('视频读取被中止');
                };

                console.log('开始读取视频数据为DataURL');
                reader.readAsDataURL(blob);
            })
            .catch(error => {
                console.error('视频分析错误:', error);
                showAnalysisStatus('分析失败: ' + error.message);
                callback(false, error.message);
            });

    } catch (error) {
        console.error('发送视频分析错误:', error);
        showAnalysisStatus('分析失败: ' + error.message);
        callback(false, error.message);
    }
}

/**
 * 发送视频数据给AI分析 - 改进版本（自动调用场景）
 */
function sendVideoForAnalysis() {
    if (!sessionData.videoCache) {
        console.log('没有视频缓存，跳过AI分析');
        return;
    }

    if (!socket || !socket.connected) {
        console.log('未连接到服务器，跳过AI分析');
        return;
    }

    showAnalysisStatus('准备视频数据...');

    // 发送分析请求
    try {
        // 直接使用Blob URL获取视频数据
        fetch(sessionData.videoCache)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP错误: ${response.status}`);
                }
                return response.blob();
            })
            .then(blob => {
                // 检查文件大小
                if (blob.size > 50 * 1024 * 1024) { // 50MB限制
                    throw new Error('视频文件过大，请缩短训练时间');
                }

                const reader = new FileReader();
                reader.onload = function() {
                    const result = reader.result;
                    const videoBase64 = result.split(',')[1];

                    // 准备姿势数据
                    const poseData = {
                        'main_pose': '未知',
                        'pose_counts': {},
                        'training_type': sessionData.type,
                        'duration': sessionData.cacheDuration
                    };

                    // 统计姿势数据
                    if (sessionData.poses && sessionData.poses.length > 0) {
                        const poseCounts = sessionData.poses.reduce((acc, pose) => {
                            acc[pose] = (acc[pose] || 0) + 1;
                            return acc;
                        }, {});
                        poseData.pose_counts = poseCounts;
                        poseData.main_pose = Object.keys(poseCounts).reduce((a, b) =>
                            poseCounts[a] > poseCounts[b] ? a : b, '未知动作'
                        );
                    }

                    console.log('发送AI分析请求...', {
                        videoSize: blob.size,
                        poseCount: sessionData.poses ? sessionData.poses.length : 0
                    });

                    // 发送分析请求，同时传递当前报告ID
                    socket.emit('analyze_video', {
                        video_data: videoBase64,
                        pose_data: poseData,
                        video_format: 'webm',
                        report_id: sessionData.currentReportId // 传递报告ID
                    });

                    showAnalysisStatus('视频数据已发送，等待分析...');
                };

                reader.onerror = (error) => {
                    throw new Error(`视频读取失败: ${error}`);
                };

                reader.onabort = () => {
                    throw new Error('视频读取被中止');
                };

                reader.readAsDataURL(blob);
            })
            .catch(error => {
                console.error('视频分析错误:', error);
                showAnalysisStatus('分析失败: ' + error.message);
            });

    } catch (error) {
        console.error('发送视频分析错误:', error);
        showAnalysisStatus('分析失败: ' + error.message);
    }
}

/**
 * 显示分析状态
 */
function showAnalysisStatus(message) {
    console.log('显示分析状态:', message);
    
    let statusElement = document.getElementById('analysisStatus');
    if (!statusElement) {
        statusElement = document.createElement('div');
        statusElement.id = 'analysisStatus';
        statusElement.className = 'analysis-status';

        const analysisInfo = document.querySelector('.analysis-info');
        if (analysisInfo) {
            analysisInfo.appendChild(statusElement);
        }
    }
    statusElement.innerHTML = `<i class="fas fa-spinner fa-spin"></i><span>${message}</span>`;
    statusElement.style.display = 'flex'; // 确保状态显示
}

/**
 * 处理AI分析结果
 */
function handleAIAnalysisResult(data) {
    console.log('收到AI分析结果:', data);
    
    // 隐藏分析状态
    const statusElement = document.getElementById('analysisStatus');
    if (statusElement) {
        statusElement.style.display = 'none';
    }
    
    // 更新报告窗口中的状态文本
    const statusText = document.getElementById('analysisStatusText');
    const analyzeBtn = document.getElementById('analyzeTrainingBtn');
    
    if (statusText) {
        statusText.textContent = '分析完成！结果已显示在AI分析报告中。';
        statusText.style.color = '#4CAF50';
    }
    
    // 恢复按钮状态
    if (analyzeBtn) {
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = '<i class="fas fa-robot"></i> AI动作分析';
    }
    
    // 将AI分析结果保存到当前会话
    saveAIAnalysisResult(data);
    
    // 将AI分析结果放入"AI教练核心建议"中
    let analysisText = '暂无分析结果。';
    if (typeof data === 'string') {
        analysisText = data;
    } else if (data && typeof data === 'object') {
        // 尝试从常见字段获取
        analysisText = data.analysis || data.message || data.result || data.advice || data.suggestion || JSON.stringify(data, null, 2);
    }
    
    // 更新当前报告中的AI教练核心建议
    const coachTipElement = document.getElementById('report-coach-tip');
    if (coachTipElement) {
        coachTipElement.textContent = analysisText;
    }
    
    // 更新缓存报告中的AI分析结果，关联当前session的报告
    updateCachedReportWithAIAnalysis(analysisText, sessionData.currentReportId);
    
    // 显示分析结果
    showAIAnalysisModal(data);
    
    // 10秒后清除状态文本
    setTimeout(() => {
        if (statusText) {
            statusText.textContent = '';
        }
    }, 10000);
}

/**
 * 更新缓存报告中的AI分析结果 - 修复版本
 */
function updateCachedReportWithAIAnalysis(analysisText, reportId = null) {
    try {
        console.log('开始更新缓存报告中的AI分析结果:', { analysisText, reportId, currentReportId: sessionData.currentReportId });

        // 获取当前用户并使用与保存时相同的 userSpecificKey
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (!currentUser) {
            console.warn('未登录用户，无法更新缓存报告');
            return;
        }
        const userSpecificKey = `cachedTrainingReports_${currentUser.username}`;

        // 从localStorage获取用户的缓存报告
        const cachedReports = JSON.parse(localStorage.getItem(userSpecificKey)) || [];
        console.log('当前用户缓存报告数量:', cachedReports.length);

        // 简单的时间格式化函数（保持原实现风格）
        function formatDuration(totalSeconds) {
            if (isNaN(totalSeconds) || totalSeconds < 0) {
                return "0秒";
            }
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = Math.floor(totalSeconds % 60);
            let parts = [];
            if (hours > 0) parts.push(`${hours}小时`);
            if (minutes > 0) parts.push(`${minutes}分`);
            if (seconds > 0 || parts.length === 0) parts.push(`${seconds}秒`);
            return parts.join('');
        }

        // 如果没有找到任何缓存报告，创建一个临时报告并保存到用户特定的键
        if (cachedReports.length === 0) {
            console.warn('没有找到用户缓存报告，创建临时报告来存储AI分析结果');

            const tempReport = {
                id: reportId || sessionData.currentReportId || Date.now(),
                type: sessionData.type || 'unknown',
                cachedAt: new Date().toISOString(),
                data: {
                    analysis: analysisText,
                    coachTip: analysisText,
                    duration: sessionData.cacheDuration ? formatDuration(sessionData.cacheDuration) : '--',
                    totalPoses: sessionData.poses ? sessionData.poses.length : 0,
                    avgProcessingTime: sessionData.processingTimes && sessionData.processingTimes.length > 0
                        ? (sessionData.processingTimes.reduce((a, b) => a + b, 0) / sessionData.processingTimes.length).toFixed(2) + ' ms'
                        : '--',
                    cacheStatus: sessionData.cacheDuration ? `${sessionData.cacheDuration}秒` : '--'
                }
            };

            cachedReports.unshift(tempReport);
            localStorage.setItem(userSpecificKey, JSON.stringify(cachedReports));
            console.log('已创建并保存临时报告，报告ID:', tempReport.id);

            initTrainingHistory();
            return;
        }

        // 找到要更新的报告：优先使用传入的 reportId，其次使用最新的（索引0）
        let targetReport = null;
        if (reportId) {
            targetReport = cachedReports.find(r => Number(r.id) === Number(reportId));
            console.log('按指定ID查找报告:', reportId, '找到:', !!targetReport);
        }
        if (!targetReport) {
            targetReport = cachedReports[0];
            console.log('使用最新的报告（位置0）作为目标:', !!targetReport);
        }

        if (targetReport) {
            if (!targetReport.data) targetReport.data = {};
            targetReport.data.analysis = analysisText;

            // 如果原来没有自定义 coachTip 或是默认提示，则用 AI 分析覆盖
            if (!targetReport.data.coachTip || targetReport.data.coachTip === '根据您的姿势分析，为您提供个性化建议') {
                targetReport.data.coachTip = analysisText;
            }

            // 持久化到与读取相同的 userSpecificKey
            localStorage.setItem(userSpecificKey, JSON.stringify(cachedReports));
            console.log('已更新缓存报告中的AI分析结果，报告ID:', targetReport.id);

            // 如果当前正在查看这个报告，则实时更新界面
            const modal = document.getElementById('cachedReportModal');
            if (modal && modal.classList.contains('active')) {
                const coachTipElement = document.getElementById('cached-report-coach-tip');
                if (coachTipElement) {
                    if (/<[a-z][\s\S]*>/i.test(analysisText)) {
                        coachTipElement.innerHTML = analysisText;
                    } else {
                        coachTipElement.textContent = analysisText;
                    }
                }
            }

            // 重新加载训练历史以刷新列表显示
            initTrainingHistory();
        } else {
            console.error('未找到目标报告，无法更新AI分析结果');
        }
    } catch (error) {
        console.error('更新缓存报告中的AI分析结果时出错:', error);
    }
}

/**
 * 显示 AI 动作分析结果模态框
 * @param {Object} data - 包含分析结果的对象
 */
function showAIAnalysisModal(data) {
    // 安全获取分析结果文本
    let analysisText = '暂无分析结果。';

    if (typeof data === 'string') {
        analysisText = data;
    } else if (data && typeof data === 'object') {
        // 尝试从常见字段获取
        analysisText = data.analysis || data.message || data.result || data.advice || data.suggestion || JSON.stringify(data, null, 2);
    }

    // 显示到页面
    const contentEl = document.getElementById('ai-analysis-content');
    if (contentEl) {
        contentEl.innerHTML = formatAnalysisText(analysisText);
    } else {
        console.error('❌ 未找到 #ai-analysis-content 元素');
        alert('分析结果：\n' + analysisText); // 降级为 alert
        return;
    }

    // 显示模态框
    const modal = document.getElementById('ai-analysis-modal');
    const backdrop = document.getElementById('modal-backdrop');
    if (modal) {
        modal.style.display = 'block';
        modal.classList.add('active');
        // 显示遮罩
        if (backdrop) backdrop.style.display = 'block';
    } else {
        console.error('❌ 未找到 #ai-analysis-modal 元素');
        alert('分析结果：\n' + analysisText); // 降级为 alert
    }
}

/**
 * 关闭AI分析结果模态框
 */
function closeAIAnalysisModal() {
    const modal = document.getElementById('ai-analysis-modal');
    const backdrop = document.getElementById('modal-backdrop');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
    if (backdrop) backdrop.style.display = 'none';
}

/**
 * 格式化分析文本（将文本转换为HTML格式）
 */
function formatAnalysisText(text) {
    if (!text) return '<p>暂无分析结果</p>';

    // 如果已经是HTML格式（包含HTML标签），直接返回
    if (/<[a-z][\s\S]*>/i.test(text)) {
        return text;
    }

    // 将文本中的换行符转换为HTML换行
    let htmlText = text.replace(/\n/g, '<br>');

    // 增强格式化：识别评分、建议等关键信息
    htmlText = htmlText
        // 识别评分
        .replace(/(评分[：:]\s*(\d+))/g, '<span class="ai-analysis-rating" style="color: #4CAF50; font-weight: bold;">$1</span>')
        // 识别数字列表
        .replace(/(\d+\.)\s*(.+?)(?=<br>|$)/g, '<strong>$1</strong> $2<br>')
        // 识别关键部分
        .replace(/(主要优点|需要改进|训练建议|动作标准度|1\.|2\.|3\.|4\.)/g, '<strong style="color: #2196F3;">$1</strong>')
        // 添加段落间距
        .replace(/(<br>){2,}/g, '</p><p>');

    return `<p>${htmlText}</p>`;
}

/**
 * 保存分析报告
 */
function saveAnalysisReport(encodedText) {
    try {
        const text = atob(encodedText);
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `篮球训练AI分析报告_${new Date().toLocaleDateString()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);

        // 显示保存成功提示
        showTempMessage('报告保存成功！', 'success');
    } catch (error) {
        console.error('保存报告失败:', error);
        showTempMessage('保存失败，请重试', 'error');
    }
}

/**
 * 显示临时消息
 */
function showTempMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `temp-message ${type}`;
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
        color: white;
        border-radius: 4px;
        z-index: 10000;
        animation: slideInRight 0.3s ease;
    `;

    document.body.appendChild(messageDiv);

    setTimeout(() => {
        messageDiv.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 300);
    }, 3000);
}

// 添加CSS动画
if (!document.querySelector('#tempMessageStyles')) {
    const style = document.createElement('style');
    style.id = 'tempMessageStyles';
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}

/**
 * 查看服务器端报告（占位函数）
 */
function viewServerReport() {
    alert('该功能正在开发中，目前仅支持查看本地缓存报告');
}

/**
 * 保存AI分析结果到当前会话
 */
function saveAIAnalysisResult(data) {
    // 将AI分析结果保存到sessionData中
    if (!sessionData.aiAnalysis) {
        sessionData.aiAnalysis = {};
    }
    
    // 保存分析结果
    if (typeof data === 'string') {
        sessionData.aiAnalysis.result = data;
    } else if (data && typeof data === 'object') {
        sessionData.aiAnalysis = {...sessionData.aiAnalysis, ...data};
    }
    
    console.log('AI分析结果已保存到当前会话:', sessionData.aiAnalysis);
}

/**
 * 从本地缓存加载报告
 */
function loadCachedReports() {
    try {
        // 获取当前登录用户
        const currentUser = JSON.parse(localStorage.getItem('currentUser'));
        if (!currentUser) {
            console.warn('未登录用户，无法加载训练记录');
            return [];
        }
        
        // 构建用户特定的存储键
        const userSpecificKey = `cachedTrainingReports_${currentUser.username}`;
        
        // 从localStorage获取当前用户的缓存报告
        const cachedReports = JSON.parse(localStorage.getItem(userSpecificKey)) || [];
        return cachedReports;
    } catch (error) {
        console.error('加载本地缓存报告时出错:', error);
        return [];
    }
}

/**
 * 显示缓存的报告列表
 */
function displayCachedReports() {
    const cachedReports = loadCachedReports();
    // 使用训练记录容器而不是不存在的cachedReportsContainer
    const reportsContainer = document.querySelector('.training-records');
    
    if (!reportsContainer) return;
    
    // 清空容器并添加标题
    reportsContainer.innerHTML = '<h3 style="margin-bottom: 20px;">缓存的训练报告</h3>';
    
    if (cachedReports.length === 0) {
        reportsContainer.innerHTML += '<p>暂无缓存的报告</p>';
        return;
    }
    
    // 添加缓存报告到现有列表
    cachedReports.forEach(report => {
        const typeText = report.type === 'shooting' ? '投篮训练' : '运球训练';
        const reportElement = document.createElement('div');
        reportElement.className = 'record-item';
        reportElement.innerHTML = `
            <div class="record-header">
                <h4>${typeText}报告</h4>
                <span class="record-date">${report.cachedAt}</span>
            </div>
            <div class="record-details">
                <div class="detail-item">
                    <span class="label">检测姿势:</span>
                    <span class="value">${report.data.totalPoses || 0} 次</span>
                </div>
                <div class="detail-item">
                    <span class="label">训练时长:</span>
                    <span class="value">${report.data.duration || '--'}</span>
                </div>
                ${report.data.videoCache ? '<div class="detail-item"><span class="label">缓存:</span><span class="value">✓</span></div>' : ''}
            </div>
            <div class="record-actions">
                <button class="btn btn-secondary" onclick="viewCachedReport('${report.id}')">查看详情</button>
            </div>
        `;
        reportsContainer.appendChild(reportElement);
    });
}

/**
 * 显示缓存报告详情模态框 - 修复版本
 */
function showCachedReportModal(report) {
    console.log('显示缓存报告详情:', report);
    
    const typeText = report.type === 'shooting' ? '投篮训练' : '运球训练';
    
    // 填充报告数据
    const titleElement = document.getElementById('cached-report-title');
    const dateElement = document.getElementById('cached-report-date');
    const poseCountElement = document.getElementById('cached-report-pose-count');
    const durationElement = document.getElementById('cached-report-duration');
    const avgProcessingTimeElement = document.getElementById('cached-report-avg-processing-time');
    const cacheStatusElement = document.getElementById('cached-report-cache-status');
    const coachTipElement = document.getElementById('cached-report-coach-tip');
    
    if (titleElement) titleElement.textContent = `${typeText}报告`;
    // 使用更准确的日期格式化
    if (dateElement) dateElement.textContent = new Date(report.cachedAt).toLocaleString('zh-CN');
    if (poseCountElement) poseCountElement.textContent = (report.data.totalPoses || 0) + ' 次';
    if (durationElement) durationElement.textContent = report.data.duration || '--';
    if (avgProcessingTimeElement) avgProcessingTimeElement.textContent = (report.data.avgProcessingTime || '--') + ' ms';
    if (cacheStatusElement) cacheStatusElement.textContent = report.data.cacheStatus || '--';
    
    // 显示AI分析结果或教练建议 - 修复版本
    let coachTipText = '根据您的姿势分析，为您提供个性化建议';
    console.log('报告数据详情:', report.data);
    
    // 按优先级显示内容：
    // 1. AI分析结果 (analysis)
    // 2. 教练建议 (coachTip)
    // 3. 默认文本
    if (report.data.analysis) {
        // 优先显示AI分析结果，并进行格式化
        coachTipText = report.data.analysis;
        console.log('使用AI分析结果:', coachTipText);
    } else if (report.data.coachTip && report.data.coachTip !== '根据您的姿势分析，为您提供个性化建议') {
        // 如果没有AI分析结果，则显示教练建议（排除默认文本）
        coachTipText = report.data.coachTip;
        console.log('使用教练建议:', coachTipText);
    }
    
    if (coachTipElement) coachTipElement.textContent = coachTipText;
    
    // 显示模态框
    const modal = document.getElementById('cachedReportModal'); // 修复ID匹配问题
    const backdrop = document.getElementById('modal-backdrop');
    if (modal) {
        modal.style.display = 'block';
        modal.classList.add('active');
        // 显示遮罩
        if (backdrop) backdrop.style.display = 'block';
    } else {
        console.error('❌ 未找到 #cachedReportModal 元素');
        alert('分析结果：\n' + coachTipText); // 修复未定义变量问题，使用coachTipText
    }
}

/**
 * 保存回放视频到本地
 */
function saveReplayVideo() {
    if (!sessionData.videoCache) {
        alert('没有可保存的视频回放');
        return;
    }

    try {
        // 创建下载链接
        const a = document.createElement('a');
        a.href = sessionData.videoCache;
        
        // 生成文件名：训练类型 + 时间戳
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const typeName = sessionData.type === 'shooting' ? '投篮训练' : '运球训练';
        a.download = `篮球${typeName}_${timestamp}.webm`;
        
        // 触发下载
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        console.log('回放视频已保存');
        
        // 显示保存成功提示
        showSaveSuccessMessage();
        
    } catch (error) {
        console.error('保存回放视频失败:', error);
        alert('保存视频失败，请重试');
    }
}

/**
 * 显示保存成功提示
 */
function showSaveSuccessMessage() {
    // 创建提示元素
    const message = document.createElement('div');
    message.textContent = '视频已保存到下载文件夹';
    message.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #4CAF50;
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        z-index: 10000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        animation: slideInRight 0.3s ease;
    `;
    
    document.body.appendChild(message);
    
    // 3秒后自动消失
    setTimeout(() => {
        message.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (message.parentNode) {
                message.parentNode.removeChild(message);
            }
        }, 300);
    }, 3000);
}

/**
 * 初始化保存按钮样式
 */
function initSaveButton() {
    // 在回放控制区域添加一些样式
    const style = document.createElement('style');
    style.textContent = `
        .btn-control {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: #f8f9fa;
            border: 1px solid #ddd;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .btn-control:hover {
            background: #e9ecef;
            border-color: #adb5bd;
        }
        
        .btn-control:active {
            background: #dee2e6;
        }
        
        .btn-control i {
            font-size: 14px;
        }
        
        .btn-control span {
            font-size: 12px;
            font-weight: 500;
        }
        
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}

// 在页面加载时初始化保存按钮
document.addEventListener('DOMContentLoaded', () => {
    initSaveButton();


    if (coachTipElement) {
        // 如果是HTML格式的内容，使用innerHTML，否则使用textContent
        if (/<[a-z][\s\S]*>/i.test(coachTipText)) {
            coachTipElement.innerHTML = coachTipText;
        } else {
            coachTipElement.textContent = coachTipText;
        }
    }
    const modal = document.getElementById('cachedReportModal');
    const backdrop = document.getElementById('modal-backdrop');
    
    // 确保正确显示模态框和遮罩层
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
    }
    if (backdrop) {
        backdrop.style.display = 'block';
        backdrop.classList.add('active');
    }

});
/**
 * 关闭缓存报告详情模态框
 */
function closeCachedReportModal() {
    const modal = document.getElementById('cachedReportModal');
    const backdrop = document.getElementById('modal-backdrop');
    
    // 确保正确隐藏模态框和遮罩层
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
    if (backdrop) {
        backdrop.style.display = 'block';
        backdrop.classList.add('active');
    }
}

/**
 * 关闭缓存报告详情模态框
 */
function closeCachedReportModal() {
    const modal = document.getElementById('cachedReportModal');
    const backdrop = document.getElementById('modal-backdrop');
    
    // 确保正确隐藏模态框和遮罩层
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
    }
    if (backdrop) {
        backdrop.classList.remove('active');
        backdrop.style.display = 'none';
    }
}

/**
 * 创建缓存报告详情模态框
 */
function createCachedReportModal() {
    // 检查是否已经存在模态框
    if (document.getElementById('cachedReportModal')) {
        return;
    }
    
    const modalHTML = `
        <div id="cachedReportModal" class="report-modal" style="display: none;">
            <div class="modal-content">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 id="cached-report-title" class="modal-title">训练报告</h2>
                    <button onclick="closeCachedReportModal()" style="background: none; border: none; font-size: 24px; cursor: pointer;">×</button>
                </div>
                
                <p style="text-align: right; color: #666; margin-bottom: 20px;">
                    缓存时间: <span id="cached-report-date"></span>
                </p>
                
                <div class="report-summary">
                    <div class="summary-item">
                        <span class="label">检测到的姿势</span>
                        <span class="value" id="cached-report-pose-count">--</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">训练时长</span>
                        <span class="value" id="cached-report-duration">--</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">平均处理时间</span>
                        <span class="value" id="cached-report-avg-processing-time">-- ms</span>
                    </div>
                    <div class="summary-item">
                        <span class="label">缓存视频</span>
                        <span class="value" id="cached-report-cache-status">--</span>
                    </div>
                </div>
                
                <div class="report-feedback">
                    <h4><i class="fas fa-bullseye"></i> AI教练核心建议</h4>
                    <p id="cached-report-coach-tip">根据您的姿势分析，为您提供个性化建议</p>
                </div>
                
                <div class="modal-buttons" style="margin-top: 20px; text-align: center;">
                    <button class="btn btn-primary" onclick="closeCachedReportModal()">关闭</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * 统一关闭所有模态框函数
 */
function closeAllModals() {
    // 关闭AI分析模态框
    const aiModal = document.getElementById('ai-analysis-modal');
    if (aiModal) aiModal.classList.remove('active');
    
    // 关闭报告模态框
    const reportModal = document.getElementById('reportModal');
    if (reportModal) reportModal.classList.remove('active');
    
    // 关闭回放模态框
    const replayModal = document.getElementById('replayModal');
    if (replayModal) replayModal.classList.remove('active');
    
    // 关闭缓存报告模态框
    const cachedReportModal = document.getElementById('cachedReportModal');
    if (cachedReportModal) cachedReportModal.classList.remove('active');
    
    // 隐藏遮罩层
    const backdrop = document.getElementById('modal-backdrop');
    if (backdrop) backdrop.classList.remove('active');
}


/**
 * 更新缓存按钮状态
 */
function updateCacheButtonState() {
    const toggleCacheBtn = document.getElementById('toggleCache');
    if (toggleCacheBtn) {
        if (isCaching) {
            toggleCacheBtn.innerHTML = '<i class="fas fa-video"></i><span>缓存: 开</span>';
            toggleCacheBtn.classList.add('active');
        } else {
            toggleCacheBtn.innerHTML = '<i class="fas fa-video"></i><span>缓存: 关</span>';
            toggleCacheBtn.classList.remove('active');
        }
    }
}
