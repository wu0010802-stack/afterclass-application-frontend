
document.addEventListener('DOMContentLoaded', () => {
    // Start all data loading concurrently
    Promise.all([
        loadCoursesAndSupplies(),
        loadClasses(),
        fetchRegistrationTime(),
        loadCourseVideos()
    ]).then(() => {
        // These depend on the initial UI being built
        fetchCourseAvailability();
        renderVideoButtons(); // This needs to be called after courses are on the page
    }).catch(error => {
        console.error("Initialization failed:", error);
        showToast("頁面初始化失敗，請重新整理。", "error");
    });

    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.addEventListener('click', handleSubmitRegistration);
    }
});


// --- DATA LOADING AND UI RENDERING ---

async function loadCoursesAndSupplies() {
    try {
        const response = await apiFetch('/api/courses');
        if (!response.ok) throw new Error('Failed to fetch courses');

        const courses = await response.json();

        const courseContainer = document.getElementById('courseList');
        const supplyContainer = document.getElementById('suppliesList');

        courseContainer.innerHTML = ''; // Clear placeholder

        courses.forEach(course => {
            const courseHTML = `
                <label class="course-item">
                    <input type="checkbox" name="course" value="${course.name}" data-price="${course.price}">
                    <span class="course-text">
                        ${course.name} <span class="price-tag">${course.sessions || ''}堂 $${course.price}</span>
                        <span class="rem-count">${course.frequency || ''}</span>
                    </span>
                </label>
            `;
            courseContainer.innerHTML += courseHTML;
        });

        // Hardcoded supplies as there is no API endpoint yet
        const supplies = [
            { name: '全套舞蹈服裝', price: 1400 },
            { name: '舞衣', price: 700 },
            { name: '舞鞋', price: 250 },
            { name: '舞襪', price: 150 },
            { name: '舞袋', price: 300 }
        ];

        supplyContainer.innerHTML = ''; // Clear placeholder
        supplies.forEach(supply => {
            const supplyHTML = `
                <label class="course-item">
                    <input type="checkbox" name="supply" value="${supply.name}" data-price="${supply.price}">
                     ${supply.name} ${supply.price}元
                </label>
            `;
            supplyContainer.innerHTML += supplyHTML;
        });

    } catch (e) {
        console.error('Failed to load courses:', e);
        showToast("無法載入課程列表。", "error");
    }
}


async function loadClasses() {
    try {
        const response = await apiFetch('/api/classes');
        if (!response.ok) throw new Error('Failed to fetch classes');

        const classes = await response.json();
        const container = document.getElementById('classList');

        if (container && classes.length > 0) {
            container.innerHTML = ''; // Clear placeholder
            classes.forEach(clsName => {
                const label = document.createElement('label');
                label.className = 'radio-item';
                label.innerHTML = `<input type="radio" name="class" value="${clsName}"> ${clsName}`;
                container.appendChild(label);
            });
        }
    } catch (e) {
        console.error('Failed to load classes:', e);
    }
}


async function fetchRegistrationTime() {
    try {
        const response = await apiFetch('/api/settings/registration-time');
        if (response.ok) {
            const data = await response.json();
            checkRegistrationTime(data.start, data.end);
        }
    } catch (error) {
        console.error('Failed to fetch registration time:', error);
    }
}

function checkRegistrationTime(start, end) {
    const notice = document.getElementById('registrationNotice');
    if (!notice) return;

    const startDate = start ? new Date(start) : null;
    const endDate = end ? new Date(end) : null;
    const now = new Date();

    if (!startDate || !endDate) {
        notice.style.display = 'none';
        return;
    }

    if (now < startDate) {
        const daysLeft = Math.ceil((startDate - now) / (1000 * 60 * 60 * 24));
        notice.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 24px;">⏰</span>
                <div>
                    <strong style="color: #856404;">報名尚未開放</strong><br>
                    <span style="font-size: 14px; color: #856404;">
                        報名開始時間：<strong>${startDate.toLocaleString('zh-TW')}</strong> | 距離開放還有 <strong>${daysLeft}</strong> 天
                    </span>
                </div>
            </div>`;
        notice.style.display = 'block';
    } else if (now > endDate) {
        notice.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 24px;">🔒</span>
                <div>
                    <strong style="color: #721c24;">報名已截止</strong><br>
                    <span style="font-size: 14px; color: #721c24;">感謝您的關注，本期報名已結束</span>
                </div>
            </div>`;
        notice.style.display = 'block';
        notice.style.background = 'linear-gradient(135deg, #f8d7da, #f5c6cb)';
        notice.style.borderLeftColor = '#dc3545';
    } else {
        notice.style.display = 'none';
    }
}


async function fetchCourseAvailability() {
    try {
        const response = await apiFetch('/api/courses/availability');
        if (response.ok) {
            const availability = await response.json();
            updateCourseAvailabilityUI(availability);
        }
    } catch (error) {
        console.error('Failed to fetch availability:', error);
    }
}

function updateCourseAvailabilityUI(availability) {
    document.querySelectorAll('#courseList input[type="checkbox"]').forEach(checkbox => {
        const courseName = checkbox.value;
        if (availability[courseName] !== undefined) {
            const remaining = availability[courseName];
            const courseTextSpan = checkbox.nextElementSibling; // The <span class="course-text">

            let qtySpan = courseTextSpan.querySelector('.qty-display');
            if (!qtySpan) {
                qtySpan = document.createElement('span');
                qtySpan.className = 'qty-display';
                qtySpan.style.fontWeight = 'bold';
                qtySpan.style.marginLeft = '8px';
                courseTextSpan.appendChild(qtySpan);
            }

            if (remaining <= 0) {
                qtySpan.textContent = `(額滿，排候補)`;
                qtySpan.style.color = '#e67e22';
            } else {
                qtySpan.textContent = `(剩餘: ${remaining})`;
                qtySpan.style.color = '#d93025';
            }
        }
    });
}


// --- FORM SUBMISSION ---

async function handleSubmitRegistration() {
    // Check network status immediately
    if (!navigator.onLine) {
        showToast('網路連線失敗，無法送出報名表，請檢查您的網路連線。', 'error');
        return;
    }

    const name = document.getElementById('studentName').value;
    const birthday = document.getElementById('studentBirthday').value;
    const classSelected = document.querySelector('input[name="class"]:checked');

    if (!name || !birthday || !classSelected) {
        showToast('請填寫完整的幼兒姓名、生日及班級。', 'error');
        return;
    }

    // Birthday validation: Future date check
    const inputDate = new Date(birthday);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to compare dates only
    
    if (inputDate > today) {
        showToast('出生日期無效：不能選擇未來的日期。', 'error');
        return;
    }

    const selectedCourses = Array.from(document.querySelectorAll('#courseList input:checked')).map(cb => ({
        name: cb.value,
        price: cb.dataset.price
    }));

    const selectedSupplies = Array.from(document.querySelectorAll('#suppliesList input:checked')).map(cb => ({
        name: cb.value,
        price: cb.dataset.price
    }));

    if (selectedCourses.length === 0) {
        showToast('請至少選擇一門才藝課。', 'error');
        return;
    }

    const payload = {
        name,
        birthday,
        class: classSelected.value,
        courses: selectedCourses,
        supplies: selectedSupplies
    };

    try {
        const response = await apiFetch('/submit-registration', {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        // Handle JSON parsing error if backend returns non-JSON (e.g. 500 HTML page)
        let result;
        try {
            result = await response.json();
        } catch (e) {
            throw new Error('伺服器回應格式錯誤，請聯繫管理員。');
        }

        if (response.ok) {
            showToast(result.message || '報名成功！', 'success');
            document.querySelector('form').reset();
            fetchCourseAvailability(); // Refresh availability
            // Scroll to top to see success message clearly
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            throw new Error(result.message || '報名失敗，請稍後再試。');
        }
    } catch (error) {
        console.error('Error:', error);
        // Identify network errors (fetch failure)
        if (error.name === 'TypeError' && error.message.includes('fetch') || error.message.includes('Network request failed')) {
            showToast('網路連線失敗，請檢查您的網路連線。', 'error');
        } else {
            showToast(error.message, 'error');
        }
    }
}


// --- VIDEO MODAL ---
let courseVideos = {};

async function loadCourseVideos() {
    try {
        const response = await apiFetch('/api/course-videos');
        if (response.ok) {
            courseVideos = await response.json();
            return courseVideos;
        }
        return {};
    } catch (error) {
        console.error('Failed to load course videos:', error);
        return {};
    }
}

function renderVideoButtons() {
    document.querySelectorAll('#courseList .course-item').forEach(item => {
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (!checkbox) return;
        const courseName = checkbox.value;
        const videoUrl = courseVideos[courseName];

        const existingBtn = item.querySelector('.video-btn');
        if (existingBtn) existingBtn.remove();

        if (videoUrl) {
            const btn = document.createElement('button');
            btn.className = 'video-btn';
            btn.type = 'button';
            btn.innerHTML = '▶ 課程介紹';
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                openVideoModal(courseName, videoUrl);
            };
            item.querySelector('.course-text').appendChild(btn);
        }
    });
}

function openVideoModal(title, url) {
    const modal = document.getElementById('videoModal');
    const videoContainer = document.getElementById('videoContainer');
    const titleEl = document.getElementById('videoModalTitle');

    titleEl.textContent = title;
    modal.classList.add('active');
    videoContainer.innerHTML = '';

    const youtubeId = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);

    if (youtubeId) {
        videoContainer.innerHTML = `<iframe width="100%" height="450" src="https://www.youtube.com/embed/${youtubeId[1]}?autoplay=1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="border:none; border-radius:8px;"></iframe>`;
    } else {
        videoContainer.innerHTML = `<video id="videoPlayer" controls autoplay style="width:100%; border-radius:8px;" src="${url}">您的瀏覽器不支援影片播放</video>`;
    }
}

function closeVideoModal() {
    const modal = document.getElementById('videoModal');
    const videoContainer = document.getElementById('videoContainer');
    if (videoContainer) videoContainer.innerHTML = '';
    modal.classList.remove('active');
}

document.getElementById('videoModal')?.addEventListener('click', function (e) {
    if (e.target === this) closeVideoModal();
});
