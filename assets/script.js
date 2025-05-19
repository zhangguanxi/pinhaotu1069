        const backgroundColors = {
            white: [255, 255, 255],
            black: [0, 0, 0],
            transparent: [0, 0, 0, 0]
        };
        let restoreFiles = [];
        let restoreImageDatas = [];
        let splitFiles = [];
        let isProcessing = false;
        let fragmentCanvases = [];
        let previewUrl = null; // 新增：拆分预览URL
        let restoreUrls = []; // 新增：还原缩略图URL数组
        function getTimestamp() {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hour = String(now.getHours()).padStart(2, '0');
            const minute = String(now.getMinutes()).padStart(2, '0');
            const second = String(now.getSeconds()).padStart(2, '0');
            return `${year}${month}${day}${hour}${minute}${second}`;
        }
        function switchTab(tabId) {
            const tab = document.querySelector(`.tab[data-tab="${tabId}"]`);
            if (!tab) {
                console.error(`Tab not found: .tab[data-tab="${tabId}"]`);
                return;
            }
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const content = document.getElementById(tabId);
            if (!content) {
                console.error(`Content not found: #${tabId}`);
                return;
            }
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            content.classList.add('active');
            const preview = document.getElementById('preview');
            if (preview) preview.style.display = 'none'; // 添加检查
            document.getElementById('splitPreview').style.display = 'none';
            document.getElementById('downloadButtons').style.display = 'none';
            document.getElementById('successMessage').classList.remove('show');
            const existingContainer = document.querySelector('.preview-container');
            if (existingContainer) existingContainer.remove();
            if (tabId === 'restore') {
                updateThumbnails();
            } else {
                updateSplitThumbnails();
            }
        }
        function switchShapeTab() {
            const tab = document.querySelector('.shape-tab[data-shape="square"]');
            if (tab) tab.classList.add('active');
            const content = document.getElementById('square');
            if (content) content.classList.add('active');
        }
        function bindEvents() {
            document.querySelectorAll('.tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    const tabId = tab.getAttribute('data-tab');
                    if (tabId) {
                        switchTab(tabId);
                    } else {
                        console.error('Tab missing data-tab attribute:', tab);
                    }
                });
            });
            document.getElementById('uploadArea').addEventListener('click', () => {
                document.getElementById('images').click();
            });
            document.getElementById('splitUploadArea').addEventListener('click', () => {
                document.getElementById('splitImage').click();
            });
            document.getElementById('thumbnailList').addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-btn')) {
                    const index = parseInt(e.target.parentElement.dataset.index);
                    restoreFiles.splice(index, 1);
                    restoreUrls.splice(index, 1);
                    updateThumbnails();
                    processImages();
                }
            });
        }
        function updateRangeValue(inputId, valueId) {
            document.getElementById(valueId).textContent = document.getElementById(inputId).value;
        }
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
            document.querySelector('.container').classList.add('dragover');
        });
        document.addEventListener('dragleave', (e) => {
            e.preventDefault();
            document.querySelector('.container').classList.remove('dragover');
        });
        document.addEventListener('drop', (e) => {
            e.preventDefault();
            document.querySelector('.container').classList.remove('dragover');
            const droppedFiles = Array.from(e.dataTransfer.files).filter(file =>
                file.type === 'image/png' || file.type === 'image/jpeg' || file.type === 'image/jpg'
            );
            if (document.getElementById('restore').classList.contains('active')) {
                handleFiles(droppedFiles);
            } else if (document.getElementById('split').classList.contains('active')) {
                handleSplitFiles(droppedFiles.slice(0, 1));
            }
        });
        function handleFileSelect(event) {
            restoreUrls.forEach(url => URL.revokeObjectURL(url)); // 释放旧URL
            restoreUrls = []; // 清空URL数组
            restoreFiles = []; // 清空旧图片
            const selectedFiles = Array.from(event.target.files);
            handleFiles(selectedFiles);
            event.target.value = null;
        }
        function handleSplitFileSelect(event) {
            if (previewUrl) URL.revokeObjectURL(previewUrl); // 释放旧URL
            previewUrl = null; // 重置
            splitFiles = []; // 清空旧图片
            fragmentCanvases.forEach(canvas => canvas = null); // 释放旧Canvas
            fragmentCanvases = []; // 清空Canvas数组
            const selectedFiles = Array.from(event.target.files);
            handleSplitFiles(selectedFiles.slice(0, 1));
            event.target.value = null; // 确保输入框重置
        }
        function handleFiles(newFiles) {
            restoreFiles = restoreFiles.concat(newFiles);
            updateThumbnails();
            processImages();
        }
        function handleSplitFiles(newFiles) {
            splitFiles = newFiles;
            updateSplitThumbnails();
        }
        function updateThumbnails() {
            const thumbnailList = document.getElementById('thumbnailList');
            const fragment = document.createDocumentFragment();
            restoreUrls.forEach(url => URL.revokeObjectURL(url));
            restoreUrls = [];
            restoreFiles.forEach((file, index) => {
                const thumbnail = document.createElement('div');
                thumbnail.className = 'thumbnail';
                thumbnail.dataset.index = index; // 存储索引
                const img = document.createElement('img');
                const url = URL.createObjectURL(file);
                restoreUrls.push(url);
                img.src = url;
                thumbnail.appendChild(img);
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'delete-btn';
                deleteBtn.innerText = '×';
                thumbnail.appendChild(deleteBtn);
                fragment.appendChild(thumbnail);
            });
            thumbnailList.innerHTML = '';
            thumbnailList.appendChild(fragment);
        }
        function updateSplitThumbnails() {
            let preview = document.getElementById('preview');
            const rightPanel = document.querySelector('.right-panel');
            const uploadPrompt = document.querySelector('#splitUploadArea .upload-prompt');
            let previewContainer = document.querySelector('.preview-container');
            
            console.log('updateSplitThumbnails: splitFiles length:', splitFiles.length); // 调试日志
            
            // 如果 preview 不存在，重新创建并添加到 right-panel
            if (!preview) {
                preview = document.createElement('img');
                preview.id = 'preview';
                preview.alt = '处理结果';
                rightPanel.insertBefore(preview, document.getElementById('splitPreview'));
            }
            
            // 移除旧的 previewContainer
            if (previewContainer) previewContainer.remove();
            
            // 创建新的 previewContainer
            previewContainer = document.createElement('div');
            previewContainer.className = 'preview-container';
            previewContainer.appendChild(preview); // 将 preview 放入容器
            rightPanel.insertBefore(previewContainer, document.getElementById('splitPreview'));
            
            if (splitFiles.length > 0) {
                if (previewUrl) URL.revokeObjectURL(previewUrl); // 释放旧URL
                previewUrl = URL.createObjectURL(splitFiles[0]); // 存储新URL
                console.log('Setting preview.src to:', previewUrl); // 调试日志
                preview.src = previewUrl;
                preview.style.display = 'block';
                uploadPrompt.classList.add('hide');
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'delete-btn';
                deleteBtn.innerText = '×';
                deleteBtn.onclick = (e) => {
                    e.stopPropagation();
                    splitFiles = [];
                    if (previewUrl) URL.revokeObjectURL(previewUrl); // 释放URL
                    previewUrl = null;
                    updateSplitThumbnails();
                    document.getElementById('splitPreview').style.display = 'none';
                    document.getElementById('downloadButtons').style.display = 'none';
                };
                previewContainer.appendChild(deleteBtn);
            } else {
                preview.style.display = 'none';
                if (previewUrl) URL.revokeObjectURL(previewUrl); // 释放URL
                previewUrl = null;
                uploadPrompt.classList.remove('hide');
                console.log('No splitFiles, hiding preview'); // 调试日志
            }
        }
        function clearImages() {
            restoreFiles = [];
            restoreImageDatas = [];
            restoreUrls.forEach(url => URL.revokeObjectURL(url)); // 释放缩略图URL
            restoreUrls = []; // 清空URL数组
            updateThumbnails();
            document.getElementById('preview').style.display = 'none';
        }
        function clearSplitImages() {
            splitFiles = [];
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            previewUrl = null;
            fragmentCanvases = [];
            updateSplitThumbnails();
            document.getElementById('splitPreview').style.display = 'none';
            document.getElementById('downloadButtons').style.display = 'none';
            document.getElementById('successMessage').classList.remove('show');
            document.getElementById('splitImage').value = null;
            const canvas = document.getElementById('canvas');
            canvas.width = 0;
            canvas.height = 0;
        }
        function handleOptionChange() {
            if (restoreFiles.length > 0) {
                processImages();
            }
        }
        async function processImages() {
            if (isProcessing) return;
            isProcessing = true;
            if (restoreFiles.length < 2) {
                const preview = document.getElementById('preview');
                if (preview) preview.style.display = 'none';
                isProcessing = false;
                return;
            }
            const loading = document.getElementById('loading');
            loading.style.display = 'block';
            document.getElementById('splitPreview').style.display = 'none';
            document.getElementById('downloadButtons').style.display = 'none';
            const canvas = document.getElementById('canvas');
            const ctx = canvas.getContext('2d');
            const backgroundType = document.querySelector('input[name="background_type"]:checked').value;
            const invertEffect = document.getElementById('invertEffect').checked;

            const images = await Promise.all(restoreFiles.map(file => loadImage(file)));
            const baseWidth = images[0].width;
            const baseHeight = images[0].height;
            canvas.width = baseWidth;
            canvas.height = baseHeight;

            // 绘制第一张图片
            ctx.drawImage(images[0], 0, 0);

            // 根据背景类型设置合成模式
            if (backgroundType === "black") {
                ctx.globalCompositeOperation = 'lighten'; // 黑色底保留较亮像素
            } else {
                ctx.globalCompositeOperation = 'multiply'; // 白色底模拟颜色相乘
            }

            // 绘制后续图片
            for (let i = 1; i < images.length; i++) {
                ctx.drawImage(images[i], 0, 0);
            }

            // 恢复默认合成模式
            ctx.globalCompositeOperation = 'source-over';

            // 如果需要反色，执行反色操作
            if (invertEffect) {
                const imageData = ctx.getImageData(0, 0, baseWidth, baseHeight);
                const data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                    if (data[i + 3] > 0) { // 仅处理非透明像素
                        data[i] = 255 - data[i];     // R
                        data[i + 1] = 255 - data[i + 1]; // G
                        data[i + 2] = 255 - data[i + 2]; // B
                    }
                }
                ctx.putImageData(imageData, 0, 0);
            }

            // 处理透明底（可选补充逻辑）
            if (backgroundType === "transparent") {
                // 可根据需求添加透明底处理逻辑，例如保留 alpha 通道
                // 示例中未实现具体逻辑
            }

            let preview = document.getElementById('preview');
            let previewContainer = document.querySelector('.preview-container');
            const rightPanel = document.querySelector('.right-panel');
            if (!previewContainer) {
                previewContainer = document.createElement('div');
                previewContainer.className = 'preview-container';
                rightPanel.insertBefore(previewContainer, document.getElementById('splitPreview'));
            }
            if (!preview) {
                preview = document.createElement('img');
                preview.id = 'preview';
                preview.alt = '处理结果';
                previewContainer.appendChild(preview);
            }

            preview.src = canvas.toDataURL('image/png');
            preview.style.display = 'block';
            loading.style.display = 'none';
            isProcessing = false;
        }        
        function downloadImage() {
            const preview = document.getElementById('preview');
            if (preview.style.display === 'none') {
                alert('请先处理图片！');
                return;
            }
            const link = document.createElement('a');
            link.href = preview.src;
            link.download = `image_${getTimestamp()}.png`;
            link.click();
        }
        async function fragmentImage() {
            if (isProcessing) return;
            isProcessing = true;
            if (splitFiles.length === 0) {
                alert('请上传一张图片！');
                isProcessing = false;
                return;
            }
            const loading = document.getElementById('loading');
            loading.style.display = 'block';
            document.getElementById('splitPreview').style.display = 'none';
            document.getElementById('downloadButtons').style.display = 'none';
            fragmentCanvases = [];
            const numOutputImages = parseInt(document.getElementById('numOutputImages').value);
            const squareSize = parseInt(document.getElementById('squareSize').value);
            const backgroundType = document.querySelector('input[name="split_background"]:checked').value;
            const colorMode = document.querySelector('input[name="color_mode"]:checked').value;
            const file = splitFiles[0];
            const img = await loadImage(file);
            const canvas = document.getElementById('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            let imageData = ctx.getImageData(0, 0, img.width, img.height);
            if (colorMode === 'invert') {
                ctx.filter = 'invert(100%)';
                ctx.drawImage(img, 0, 0);
                ctx.filter = 'none';
                imageData = ctx.getImageData(0, 0, img.width, img.height);
            }
            const blockMap = new Uint8Array(img.width * img.height);
            const blockCount = Math.ceil(img.width / squareSize) * Math.ceil(img.height / squareSize);
            const blocksPerImage = Math.floor(blockCount / numOutputImages);

            for (let y = 0, blockIdx = 0; y < img.height; y += squareSize) {
                for (let x = 0; x < img.width; x += squareSize, blockIdx++) {
                    const fragmentIdx = Math.floor(Math.random() * numOutputImages);
                    for (let dy = 0; dy < squareSize && y + dy < img.height; dy++) {
                        for (let dx = 0; dx < squareSize && x + dx < img.width; dx++) {
                            blockMap[(y + dy) * img.width + (x + dx)] = fragmentIdx;
                        }
                    }
                }
            }

            fragmentCanvases = [];
            for (let i = 0; i < numOutputImages; i++) {
                const outputCanvas = document.createElement('canvas');
                outputCanvas.width = img.width;
                outputCanvas.height = img.height;
                const outputCtx = outputCanvas.getContext('2d');
                const outputData = ctx.createImageData(img.width, img.height);
                for (let j = 0; j < imageData.data.length; j += 4) {
                    if (blockMap[j / 4] === i) {
                        outputData.data[j] = imageData.data[j];
                        outputData.data[j + 1] = imageData.data[j + 1];
                        outputData.data[j + 2] = imageData.data[j + 2];
                        outputData.data[j + 3] = imageData.data[j + 3];
                    } else {
                        outputData.data[j + 3] = 0;
                    }
                }
                outputCtx.putImageData(outputData, 0, 0);
                if (backgroundType !== 'transparent') {
                    const bgCanvas = document.createElement('canvas');
                    bgCanvas.width = img.width;
                    bgCanvas.height = img.height;
                    const bgCtx = bgCanvas.getContext('2d');
                    bgCtx.fillStyle = backgroundType === 'white' ? '#fff' : '#000';
                    bgCtx.fillRect(0, 0, img.width, img.height);
                    bgCtx.drawImage(outputCanvas, 0, 0);
                    fragmentCanvases.push(bgCanvas);
                } else {
                    fragmentCanvases.push(outputCanvas);
                }
            }

            const splitPreview = document.getElementById('splitPreview');
            splitPreview.innerHTML = '';
            const timestamp = getTimestamp().slice(0, -2);
            fragmentCanvases.forEach((canvas, index) => {
                const previewItem = document.createElement('div');
                previewItem.className = 'preview-item';
                const img = document.createElement('img');
                img.src = canvas.toDataURL('image/png');
                const label = document.createElement('div');
                label.className = 'label';
                label.textContent = `分解${index + 1}`;
                const downloadBtn = document.createElement('button');
                downloadBtn.textContent = '下载';
                downloadBtn.onclick = () => {
                    const link = document.createElement('a');
                    link.href = canvas.toDataURL('image/png');
                    link.download = `image_${timestamp}_${index + 1}.png`;
                    link.click();
                };
                previewItem.appendChild(img);
                previewItem.appendChild(label);
                previewItem.appendChild(downloadBtn);
                splitPreview.appendChild(previewItem);
            });
            document.getElementById('splitPreview').style.display = 'flex';
            document.getElementById('downloadButtons').style.display = 'block';
            loading.style.display = 'none';
            document.getElementById('successMessage').classList.add('show');
            isProcessing = false;
            document.getElementById('splitImage').value = null;
}

        function downloadAllFragments() {
            const timestamp = getTimestamp().slice(0, -2);
            fragmentCanvases.forEach((canvas, index) => {
                const link = document.createElement('a');
                link.href = canvas.toDataURL('image/png');
                link.download = `image_${timestamp}_${index + 1}.png`;
                link.click();
            });
        }
        function downloadZip() {
            const zip = new JSZip();
            const timestamp = getTimestamp().slice(0, -2);
            fragmentCanvases.forEach((canvas, index) => {
                const dataUrl = canvas.toDataURL('image/png');
                const base64 = dataUrl.split(',')[1];
                zip.file(`image_${timestamp}_${index + 1}.png`, base64, { base64: true });
            });
            zip.generateAsync({ type: 'blob' }).then(blob => {
                saveAs(blob, `fragments_${timestamp}.zip`);
            });
        }
        function loadImage(file) {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.src = URL.createObjectURL(file);
            });
        }
        bindEvents();
