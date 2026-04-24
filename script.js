const canvas = document.getElementById('editorCanvas');
const ctx = canvas.getContext('2d');
let img = new Image();
let arrows = [];
let isDrawing = false;
let startX, startY, currentX, currentY;
let currentImgBase64 = null;

// --- إدارة الذاكرة (المجلدات) ---
function updateFolderList() {
    const select = document.getElementById('folderSelect');
    select.innerHTML = '<option value="">-- اختر مجلداً محفوظاً --</option>';
    const folders = JSON.parse(localStorage.getItem('arrowFolders')) || {};
    for (let name in folders) {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
    }
}
updateFolderList();

document.getElementById('saveFolderBtn').addEventListener('click', () => {
    const name = document.getElementById('folderName').value.trim();
    if (!name) return alert("الرجاء كتابة اسم المجلد");
    if (!currentImgBase64) return alert("الرجاء رفع صورة أولاً");

    const folders = JSON.parse(localStorage.getItem('arrowFolders')) || {};
    folders[name] = { image: currentImgBase64, arrows: arrows };
    
    try {
        localStorage.setItem('arrowFolders', JSON.stringify(folders));
        alert("تم الحفظ بنجاح في المتصفح!");
        updateFolderList();
        document.getElementById('folderName').value = '';
    } catch (e) {
        alert("فشل الحفظ! مساحة تخزين المتصفح ممتلئة. جرب صورة بحجم أصغر أو احذف مجلدات قديمة.");
    }
});

document.getElementById('loadFolderBtn').addEventListener('click', () => {
    const name = document.getElementById('folderSelect').value;
    if (!name) return alert("الرجاء اختيار مجلد");
    const folders = JSON.parse(localStorage.getItem('arrowFolders')) || {};
    if (folders[name]) {
        currentImgBase64 = folders[name].image;
        arrows = folders[name].arrows;
        img.onload = function() {
            canvas.width = img.width;
            canvas.height = img.height;
            drawAll();
        }
        img.src = currentImgBase64;
    }
});

document.getElementById('deleteFolderBtn').addEventListener('click', () => {
    const name = document.getElementById('folderSelect').value;
    if (!name) return;
    if (confirm(`هل أنت متأكد من حذف المجلد "${name}"؟`)) {
        const folders = JSON.parse(localStorage.getItem('arrowFolders')) || {};
        delete folders[name];
        localStorage.setItem('arrowFolders', JSON.stringify(folders));
        updateFolderList();
        alert("تم الحذف.");
    }
});

// --- رفع الصورة ---
document.getElementById('imageUploader').addEventListener('change', function(e) {
    const reader = new FileReader();
    reader.onload = function(event) {
        currentImgBase64 = event.target.result;
        img.onload = function() {
            canvas.width = img.width;
            canvas.height = img.height;
            arrows = [];
            drawAll();
        }
        img.src = currentImgBase64;
    }
    if(e.target.files[0]) reader.readAsDataURL(e.target.files[0]);
});

// --- أحداث الرسم ---
function getScale() {
    const rect = canvas.getBoundingClientRect();
    return { x: canvas.width / rect.width, y: canvas.height / rect.height };
}

canvas.addEventListener('mousedown', (e) => {
    if (!img.src) return;
    isDrawing = true;
    const scale = getScale();
    const rect = canvas.getBoundingClientRect();
    startX = (e.clientX - rect.left) * scale.x;
    startY = (e.clientY - rect.top) * scale.y;
});

canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    const scale = getScale();
    const rect = canvas.getBoundingClientRect();
    currentX = (e.clientX - rect.left) * scale.x;
    currentY = (e.clientY - rect.top) * scale.y;
    drawAll();
    // رسم السهم الحالي أثناء السحب
    const color = document.getElementById('arrowColor').value;
    const width = document.getElementById('arrowWidth').value;
    drawArrow(ctx, startX, startY, currentX, currentY, color, width);
});

canvas.addEventListener('mouseup', () => {
    if (!isDrawing) return;
    isDrawing = false;
    const color = document.getElementById('arrowColor').value;
    const width = document.getElementById('arrowWidth').value;
    if (startX !== currentX || startY !== currentY) {
        arrows.push({ x1: startX, y1: startY, x2: currentX, y2: currentY, color: color, width: width });
    }
    drawAll();
});

// --- دالة رسم السهم ---
function drawArrow(context, fromx, fromy, tox, toy, color, width) {
    const headlen = width * 3; // حجم رأس السهم يتناسب مع سمكه
    const dx = tox - fromx;
    const dy = toy - fromy;
    const angle = Math.atan2(dy, dx);
    
    context.beginPath();
    context.moveTo(fromx, fromy);
    context.lineTo(tox, toy);
    context.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
    context.moveTo(tox, toy);
    context.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
    
    context.strokeStyle = color;
    context.lineWidth = width;
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.stroke();
}

function drawAll() {
    if (!img.src) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    arrows.forEach(a => drawArrow(ctx, a.x1, a.y1, a.x2, a.y2, a.color, a.width));
}

document.getElementById('clearBtn').addEventListener('click', () => { arrows = []; drawAll(); });

// --- التصدير كملف ZIP ---
document.getElementById('exportBtn').addEventListener('click', function() {
    if (arrows.length === 0) return alert("الرجاء رسم سهم واحد على الأقل.");
    
    const btn = this;
    const originalText = btn.textContent;
    btn.textContent = "جاري التجهيز...";
    btn.disabled = true;

    let zip = new JSZip();
    let folder = zip.folder("Images_with_Arrows");

    arrows.forEach((arrow, index) => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        drawArrow(ctx, arrow.x1, arrow.y1, arrow.x2, arrow.y2, arrow.color, arrow.width);
        
        // استخراج الصورة بدون الجزء "data:image/png;base64,"
        const imgData = canvas.toDataURL('image/png').split(',')[1];
        folder.file(`image_${index + 1}.png`, imgData, {base64: true});
    });

    zip.generateAsync({type:"blob"}).then(function(content) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = "exported_images.zip";
        link.click();
        
        // إعادة الزر لشكله الطبيعي وإعادة رسم جميع الأسهم
        btn.textContent = originalText;
        btn.disabled = false;
        drawAll();
    });
});