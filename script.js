// タスク管理クラス
class TaskManager {
    constructor() {
        this.tasks = this.loadTasks();
        this.taskColors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336', '#00BCD4', '#795548'];
    }

    loadTasks() {
        const saved = localStorage.getItem('ganttTasks');
        return saved ? JSON.parse(saved) : [];
    }

    saveTasks() {
        localStorage.setItem('ganttTasks', JSON.stringify(this.tasks));
    }

    addTask(name, days) {
        const task = {
            id: Date.now(),
            name: name,
            days: parseInt(days)
            // colorプロパティを削除 - 位置ベースで色を決定
        };
        this.tasks.push(task);
        this.saveTasks();
        return task;
    }
    
    getTaskColor(index) {
        // タスクの位置（インデックス）に基づいて色を返す
        return this.taskColors[index % this.taskColors.length];
    }

    deleteTask(id) {
        this.tasks = this.tasks.filter(task => task.id !== id);
        this.saveTasks();
    }

    reorderTasks(fromIndex, toIndex) {
        const [removed] = this.tasks.splice(fromIndex, 1);
        this.tasks.splice(toIndex, 0, removed);
        this.saveTasks();
    }

    getTaskStartDate(index) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let totalDays = 0;
        for (let i = 0; i < index; i++) {
            totalDays += this.tasks[i].days;
        }
        
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() + totalDays);
        return startDate;
    }
}

// ガントチャート描画クラス
class GanttChart {
    constructor(canvas, taskManager) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.taskManager = taskManager;
        this.dayWidth = 30;
        this.rowHeight = 40;
        this.headerHeight = 60;
        this.leftPadding = 10;
        
        // ドラッグリサイズ用の状態管理
        this.taskBars = []; // タスクバーの位置情報
        this.isDragging = false;
        this.dragTaskIndex = -1;
        this.dragStartX = 0;
        this.dragStartDays = 0;
        
        this.setupMouseEvents();
    }
    
    setupMouseEvents() {
        // マウスイベントリスナーを追加
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e));
    }
    
    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    draw() {
        const tasks = this.taskManager.tasks;
        const totalDays = this.calculateTotalDays();
        
        // キャンバスサイズ設定
        this.canvas.width = Math.max(800, this.leftPadding + totalDays * this.dayWidth + 100);
        this.canvas.height = this.headerHeight + tasks.length * this.rowHeight + 40;
        
        // 背景クリア
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // ヘッダー描画
        this.drawHeader(totalDays);
        
        // タスクバー描画
        this.drawTasks();
        
        // 今日のライン描画
        this.drawTodayLine();
    }

    calculateTotalDays() {
        return Math.max(30, this.taskManager.tasks.reduce((sum, task) => sum + task.days, 0) + 10);
    }

    drawHeader(totalDays) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // 月ヘッダー
        this.ctx.fillStyle = '#f0f0f0';
        this.ctx.fillRect(0, 0, this.canvas.width, 30);
        
        // 日付ヘッダー
        this.ctx.fillStyle = '#fafafa';
        this.ctx.fillRect(0, 30, this.canvas.width, 30);
        
        let currentMonth = -1;
        let monthStartX = this.leftPadding;
        
        for (let i = 0; i < totalDays; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() + i);
            const x = this.leftPadding + i * this.dayWidth;
            
            // 月の区切り線と表示
            if (date.getMonth() !== currentMonth) {
                if (currentMonth !== -1) {
                    // 前月の幅を計算して月名を中央に配置
                    const monthWidth = x - monthStartX;
                    this.ctx.fillStyle = '#333';
                    this.ctx.font = '12px sans-serif';
                    this.ctx.textAlign = 'center';
                    const monthName = new Date(today.getFullYear(), currentMonth).toLocaleDateString('ja-JP', { month: 'long' });
                    this.ctx.fillText(monthName, monthStartX + monthWidth / 2, 20);
                }
                
                currentMonth = date.getMonth();
                monthStartX = x;
                
                // 月の区切り線
                this.ctx.strokeStyle = '#999';
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.moveTo(x, 0);
                this.ctx.lineTo(x, this.headerHeight);
                this.ctx.stroke();
            }
            
            // 日付表示
            this.ctx.fillStyle = date.getDay() === 0 || date.getDay() === 6 ? '#ff6666' : '#666';
            this.ctx.font = '11px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(date.getDate(), x + this.dayWidth / 2, 50);
            
            // グリッド線
            this.ctx.strokeStyle = '#eee';
            this.ctx.lineWidth = 0.5;
            this.ctx.beginPath();
            this.ctx.moveTo(x, this.headerHeight);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        // 最後の月を表示
        const monthWidth = (this.leftPadding + totalDays * this.dayWidth) - monthStartX;
        this.ctx.fillStyle = '#333';
        this.ctx.font = '12px sans-serif';
        this.ctx.textAlign = 'center';
        const monthName = new Date(today.getFullYear(), currentMonth).toLocaleDateString('ja-JP', { month: 'long' });
        this.ctx.fillText(monthName, monthStartX + monthWidth / 2, 20);
    }

    drawTasks() {
        const tasks = this.taskManager.tasks;
        this.taskBars = []; // 位置情報をリセット
        
        tasks.forEach((task, index) => {
            const startDate = this.taskManager.getTaskStartDate(index);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const daysFromToday = Math.floor((startDate - today) / (1000 * 60 * 60 * 24));
            const x = this.leftPadding + daysFromToday * this.dayWidth;
            const y = this.headerHeight + index * this.rowHeight + 10;
            const width = task.days * this.dayWidth - 5;
            const height = this.rowHeight - 20;
            
            // タスクバーの位置情報を保存
            this.taskBars.push({
                index: index,
                x: x,
                y: y,
                width: width,
                height: height,
                rightEdge: x + width
            });
            
            // 位置ベースで色を取得
            const taskColor = this.taskManager.getTaskColor(index);
            
            // タスクバー描画
            this.ctx.fillStyle = taskColor;
            this.ctx.fillRect(x, y, width, height);
            
            // タスクバーの枠線
            this.ctx.strokeStyle = this.darkenColor(taskColor);
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(x, y, width, height);
            
            // 進捗表示（今日より前のタスクは完了扱い）
            if (daysFromToday < 0) {
                const progressDays = Math.min(task.days, -daysFromToday);
                const progressWidth = progressDays * this.dayWidth - 5;
                
                this.ctx.fillStyle = this.darkenColor(taskColor);
                this.ctx.fillRect(x, y, progressWidth, height);
            }
            
            // タスク名を表示
            this.ctx.save();
            this.ctx.clip(new Path2D(`M${x} ${y} h${width} v${height} h-${width} z`));
            
            // 文字色を背景色に応じて決定
            const textColor = this.getContrastColor(taskColor);
            this.ctx.fillStyle = textColor;
            this.ctx.font = '12px sans-serif';
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'middle';
            
            // タスク名を描画（左側に少し余白を設ける）
            this.ctx.fillText(task.name, x + 5, y + height / 2);
            
            this.ctx.restore();
        });
    }

    drawTodayLine() {
        const x = this.leftPadding;
        
        this.ctx.strokeStyle = '#ff0000';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(x, 0);
        this.ctx.lineTo(x, this.canvas.height);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        
        // "今日" ラベル（下部に配置）
        this.ctx.fillStyle = '#ff0000';
        this.ctx.font = 'bold 12px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('今日', x, this.canvas.height - 10);
    }

    darkenColor(color) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = -30;
        const r = (num >> 16) + amt;
        const g = (num >> 8 & 0x00FF) + amt;
        const b = (num & 0x0000FF) + amt;
        return '#' + (0x1000000 + (r < 255 ? r < 1 ? 0 : r : 255) * 0x10000 +
            (g < 255 ? g < 1 ? 0 : g : 255) * 0x100 +
            (b < 255 ? b < 1 ? 0 : b : 255)).toString(16).slice(1);
    }
    
    getContrastColor(hexColor) {
        // 背景色の輝度を計算して、白か黒の文字色を返す
        const num = parseInt(hexColor.replace('#', ''), 16);
        const r = (num >> 16) & 255;
        const g = (num >> 8) & 255;
        const b = num & 255;
        
        // 輝度計算（YIQ方式）
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        
        return (yiq >= 128) ? '#000000' : '#ffffff';
    }
    
    // マウスイベントハンドラ
    handleMouseDown(e) {
        const mousePos = this.getMousePos(e);
        const hitTask = this.getTaskBarAtPosition(mousePos.x, mousePos.y);
        
        if (hitTask && this.isNearRightEdge(mousePos.x, hitTask)) {
            this.isDragging = true;
            this.dragTaskIndex = hitTask.index;
            this.dragStartX = mousePos.x;
            this.dragStartDays = this.taskManager.tasks[hitTask.index].days;
            this.canvas.style.cursor = 'ew-resize';
        }
    }
    
    handleMouseMove(e) {
        const mousePos = this.getMousePos(e);
        
        if (this.isDragging) {
            // ドラッグ中の処理
            const deltaX = mousePos.x - this.dragStartX;
            const deltaDays = Math.round(deltaX / this.dayWidth);
            const newDays = Math.max(1, this.dragStartDays + deltaDays);
            
            // 一時的にタスクの日数を更新
            this.taskManager.tasks[this.dragTaskIndex].days = newDays;
            
            // リアルタイムで再描画
            this.draw();
        } else {
            // ドラッグしていない時のカーソル制御
            const hitTask = this.getTaskBarAtPosition(mousePos.x, mousePos.y);
            if (hitTask && this.isNearRightEdge(mousePos.x, hitTask)) {
                this.canvas.style.cursor = 'ew-resize';
            } else {
                this.canvas.style.cursor = 'default';
            }
        }
    }
    
    handleMouseUp(e) {
        if (this.isDragging) {
            // ドラッグ終了時に保存とイベント発火
            this.taskManager.saveTasks();
            this.isDragging = false;
            this.dragTaskIndex = -1;
            
            // カスタムイベントを発火してUIControllerに通知
            const event = new CustomEvent('taskUpdated');
            document.dispatchEvent(event);
        }
        this.canvas.style.cursor = 'default';
    }
    
    // タスクバーのヒットテスト
    getTaskBarAtPosition(x, y) {
        for (let bar of this.taskBars) {
            if (x >= bar.x && x <= bar.rightEdge && 
                y >= bar.y && y <= bar.y + bar.height) {
                return bar;
            }
        }
        return null;
    }
    
    // 右端付近かどうかを判定
    isNearRightEdge(x, taskBar) {
        const edgeThreshold = 8; // 右端から8px以内
        return x >= taskBar.rightEdge - edgeThreshold && x <= taskBar.rightEdge + 2;
    }
}

// UIコントローラー
class UIController {
    constructor(taskManager, ganttChart) {
        this.taskManager = taskManager;
        this.ganttChart = ganttChart;
        this.taskList = document.getElementById('taskList');
        this.setupEventListeners();
        this.render();
    }

    setupEventListeners() {
        // タスク追加
        document.getElementById('addTask').addEventListener('click', () => {
            const nameInput = document.getElementById('taskName');
            const daysInput = document.getElementById('taskDays');
            
            if (nameInput.value.trim() && daysInput.value > 0) {
                this.taskManager.addTask(nameInput.value.trim(), daysInput.value);
                nameInput.value = '';
                daysInput.value = '1';
                this.render();
            }
        });

        // タイムライン更新ボタン
        document.getElementById('updateTimeline').addEventListener('click', () => {
            // 現在の日付で開始日を再計算
            this.render();
        });

        // Enterキーでも追加
        document.getElementById('taskName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('addTask').click();
            }
        });
        document.getElementById('taskDays').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('addTask').click();
            }
        });
        
        // ガントチャートからのタスク更新イベントを受信
        document.addEventListener('taskUpdated', () => {
            this.render();
        });
    }

    render() {
        this.renderTaskList();
        this.ganttChart.draw();
    }

    renderTaskList() {
        this.taskList.innerHTML = '';
        
        this.taskManager.tasks.forEach((task, index) => {
            const taskItem = document.createElement('div');
            taskItem.className = 'task-item';
            taskItem.draggable = true;
            taskItem.dataset.index = index;
            
            // 位置ベースで色を取得
            const taskColor = this.taskManager.getTaskColor(index);
            const textColor = this.ganttChart.getContrastColor(taskColor);
            
            // タスク項目全体に背景色を設定
            taskItem.style.backgroundColor = taskColor;
            taskItem.style.color = textColor;
            
            taskItem.innerHTML = `
                <div>
                    <div class="task-name">${task.name}</div>
                    <div class="task-days">${task.days}日</div>
                </div>
                <button class="delete-btn" data-id="${task.id}" style="background-color: transparent; color: ${textColor};">×</button>
            `;
            
            // ドラッグイベント
            taskItem.addEventListener('dragstart', (e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', e.target.innerHTML);
                e.target.classList.add('dragging');
                e.dataTransfer.setData('index', index);
            });
            
            taskItem.addEventListener('dragend', (e) => {
                e.target.classList.remove('dragging');
            });
            
            taskItem.addEventListener('dragover', (e) => {
                e.preventDefault();
                const draggingItem = document.querySelector('.dragging');
                const afterElement = this.getDragAfterElement(this.taskList, e.clientY);
                
                if (afterElement == null) {
                    this.taskList.appendChild(draggingItem);
                } else {
                    this.taskList.insertBefore(draggingItem, afterElement);
                }
            });
            
            taskItem.addEventListener('drop', (e) => {
                e.preventDefault();
                const fromIndex = parseInt(e.dataTransfer.getData('index'));
                
                // ドロップ先のインデックスを正確に計算
                const draggingItem = document.querySelector('.dragging');
                const allItems = [...this.taskList.querySelectorAll('.task-item')];
                const toIndex = allItems.indexOf(draggingItem);
                
                if (fromIndex !== toIndex && toIndex !== -1) {
                    this.taskManager.reorderTasks(fromIndex, toIndex);
                    this.render();
                }
            });
            
            // 削除ボタン
            taskItem.querySelector('.delete-btn').addEventListener('click', (e) => {
                this.taskManager.deleteTask(task.id);
                this.render();
            });
            
            this.taskList.appendChild(taskItem);
        });
    }

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.task-item:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    const taskManager = new TaskManager();
    const canvas = document.getElementById('ganttCanvas');
    const ganttChart = new GanttChart(canvas, taskManager);
    const uiController = new UIController(taskManager, ganttChart);
});