import './style.css';
import * as THREE from 'three';

// ============================================
// THREE.JS 3D BACKGROUND
// ============================================
function initThreeBackground() {
  const canvas = document.getElementById('bg-canvas');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x0a0a0f, 1);

  camera.position.z = 30;

  // === Particles ===
  const particleCount = 1500;
  const particleGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);

  const colorPalette = [
    new THREE.Color(0x00f0ff),
    new THREE.Color(0x7c3aed),
    new THREE.Color(0xa78bfa),
    new THREE.Color(0x34d399),
    new THREE.Color(0xf472b6),
  ];

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 80;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 80;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 80;

    const color = colorPalette[Math.floor(Math.random() * colorPalette.length)];
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;

    sizes[i] = Math.random() * 2 + 0.5;
  }

  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const particleMaterial = new THREE.PointsMaterial({
    size: 0.12,
    vertexColors: true,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });

  const particles = new THREE.Points(particleGeometry, particleMaterial);
  scene.add(particles);

  // === DNA/Vessel Helix ===
  const helixGroup = new THREE.Group();
  const helixPointCount = 200;
  const helixRadius = 8;
  const helixHeight = 50;

  const helixMaterial1 = new THREE.LineBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.2 });
  const helixMaterial2 = new THREE.LineBasicMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.2 });

  const helixPoints1 = [];
  const helixPoints2 = [];

  for (let i = 0; i < helixPointCount; i++) {
    const t = (i / helixPointCount) * Math.PI * 6;
    const y = (i / helixPointCount) * helixHeight - helixHeight / 2;
    helixPoints1.push(new THREE.Vector3(Math.cos(t) * helixRadius, y, Math.sin(t) * helixRadius));
    helixPoints2.push(new THREE.Vector3(Math.cos(t + Math.PI) * helixRadius, y, Math.sin(t + Math.PI) * helixRadius));
  }

  const helixGeom1 = new THREE.BufferGeometry().setFromPoints(helixPoints1);
  const helixGeom2 = new THREE.BufferGeometry().setFromPoints(helixPoints2);

  helixGroup.add(new THREE.Line(helixGeom1, helixMaterial1));
  helixGroup.add(new THREE.Line(helixGeom2, helixMaterial2));

  // Cross bars
  for (let i = 0; i < helixPointCount; i += 10) {
    const barGeom = new THREE.BufferGeometry().setFromPoints([helixPoints1[i], helixPoints2[i]]);
    const barMat = new THREE.LineBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.08 });
    helixGroup.add(new THREE.Line(barGeom, barMat));
  }

  helixGroup.position.x = 20;
  helixGroup.rotation.z = 0.3;
  scene.add(helixGroup);

  // === Torus (retinal ring) ===
  const torusGeom = new THREE.TorusGeometry(12, 0.3, 16, 100);
  const torusMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.08, wireframe: true });
  const torus = new THREE.Mesh(torusGeom, torusMat);
  torus.position.set(-15, 5, -10);
  scene.add(torus);

  const torusGeom2 = new THREE.TorusGeometry(8, 0.2, 16, 80);
  const torusMat2 = new THREE.MeshBasicMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.06, wireframe: true });
  const torus2 = new THREE.Mesh(torusGeom2, torusMat2);
  torus2.position.set(-15, 5, -10);
  torus2.rotation.x = Math.PI / 2;
  scene.add(torus2);

  // === Floating Sphere (cell-like) ===
  const sphereGeom = new THREE.IcosahedronGeometry(5, 1);
  const sphereMat = new THREE.MeshBasicMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.05, wireframe: true });
  const sphere = new THREE.Mesh(sphereGeom, sphereMat);
  sphere.position.set(25, -10, -15);
  scene.add(sphere);

  // === Mouse Interaction ===
  let mouseX = 0, mouseY = 0;
  const targetMouse = { x: 0, y: 0 };

  window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  // === Resize Handler ===
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // === Animation Loop ===
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();

    // Smooth mouse follow
    targetMouse.x += (mouseX - targetMouse.x) * 0.02;
    targetMouse.y += (mouseY - targetMouse.y) * 0.02;

    // Rotate particles
    particles.rotation.y = elapsed * 0.03 + targetMouse.x * 0.3;
    particles.rotation.x = elapsed * 0.01 + targetMouse.y * 0.2;

    // Animate particle positions slightly
    const posArray = particleGeometry.attributes.position.array;
    for (let i = 0; i < particleCount; i++) {
      const idx = i * 3 + 1;
      posArray[idx] += Math.sin(elapsed + i * 0.01) * 0.003;
    }
    particleGeometry.attributes.position.needsUpdate = true;

    // Helix rotation
    helixGroup.rotation.y = elapsed * 0.15;
    helixGroup.position.y = Math.sin(elapsed * 0.3) * 2;

    // Torus rotation
    torus.rotation.x = elapsed * 0.2;
    torus.rotation.y = elapsed * 0.15;
    torus2.rotation.z = elapsed * 0.1;

    // Sphere
    sphere.rotation.x = elapsed * 0.1;
    sphere.rotation.y = elapsed * 0.15;
    sphere.position.y = -10 + Math.sin(elapsed * 0.4) * 3;

    // Camera subtle sway
    camera.position.x = targetMouse.x * 2;
    camera.position.y = -targetMouse.y * 2;
    camera.lookAt(scene.position);

    renderer.render(scene, camera);
  }

  animate();
}

// ============================================
// LOADER
// ============================================
function initLoader() {
  const loader = document.getElementById('loader');
  window.addEventListener('load', () => {
    setTimeout(() => {
      loader.classList.add('hidden');
    }, 1800);
  });
}

// ============================================
// NAVBAR
// ============================================
function initNavbar() {
  const navbar = document.getElementById('navbar');
  const mobileToggle = document.getElementById('mobile-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  const navCta = document.getElementById('nav-cta');
  const navLinks = document.querySelectorAll('.nav-link');
  const mobileLinks = document.querySelectorAll('.mobile-link');

  // Scroll effect
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }

    // Active section tracking
    const sections = ['hero', 'features', 'launch', 'about'];
    for (const id of sections) {
      const section = document.getElementById(id);
      if (section) {
        const rect = section.getBoundingClientRect();
        if (rect.top <= 200 && rect.bottom >= 200) {
          navLinks.forEach(l => l.classList.remove('active'));
          const activeLink = document.querySelector(`.nav-link[data-section="${id}"]`);
          if (activeLink) activeLink.classList.add('active');
        }
      }
    }
  });

  // Mobile menu
  mobileToggle.addEventListener('click', () => {
    mobileToggle.classList.toggle('active');
    mobileMenu.classList.toggle('open');
  });

  mobileLinks.forEach(link => {
    link.addEventListener('click', () => {
      mobileToggle.classList.remove('active');
      mobileMenu.classList.remove('open');
    });
  });

  // CTA scroll
  navCta.addEventListener('click', () => {
    document.getElementById('upload').scrollIntoView({ behavior: 'smooth' });
  });

  // Mobile CTA
  document.querySelectorAll('.mobile-cta').forEach(btn => {
    btn.addEventListener('click', () => {
      mobileToggle.classList.remove('active');
      mobileMenu.classList.remove('open');
      document.getElementById('upload').scrollIntoView({ behavior: 'smooth' });
    });
  });
}

// ============================================
// STAT COUNTER ANIMATION
// ============================================
function initStatCounters() {
  const stats = document.querySelectorAll('.stat-number');
  let animated = false;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !animated) {
        animated = true;
        stats.forEach(stat => {
          const target = parseFloat(stat.dataset.target);
          const isDecimal = target % 1 !== 0;
          const duration = 2000;
          const startTime = performance.now();

          function updateCounter(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = eased * target;

            stat.textContent = isDecimal ? current.toFixed(1) : Math.floor(current).toLocaleString();

            if (progress < 1) {
              requestAnimationFrame(updateCounter);
            }
          }

          requestAnimationFrame(updateCounter);
        });
      }
    });
  }, { threshold: 0.5 });

  const heroStats = document.getElementById('hero-stats');
  if (heroStats) observer.observe(heroStats);
}

// ============================================
// INTERSECTION OBSERVERS (Scroll animations)
// ============================================
function initScrollAnimations() {
  // Feature cards
  const featureCards = document.querySelectorAll('.feature-card');
  const cardObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.classList.add('visible');
        }, index * 100);
        cardObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });

  featureCards.forEach(card => cardObserver.observe(card));

  // Timeline items
  const timelineItems = document.querySelectorAll('.timeline-item');
  const timelineObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        timelineObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  timelineItems.forEach(item => timelineObserver.observe(item));
}

// ============================================
// FILE UPLOAD
// ============================================
function initUpload() {
  const uploadZone = document.getElementById('upload-zone');
  const fileInput = document.getElementById('file-input');
  const previewZone = document.getElementById('preview-zone');
  const previewImage = document.getElementById('preview-image');
  const fileName = document.getElementById('file-name');
  const fileSize = document.getElementById('file-size');
  const removeFile = document.getElementById('remove-file');
  const nextStep1 = document.getElementById('next-step-1');

  let uploadedFile = null;

  // Click to upload
  uploadZone.addEventListener('click', () => fileInput.click());

  // Drag and drop
  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
  });

  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragover');
  });

  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleFile(file);
    }
  });

  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) {
      handleFile(fileInput.files[0]);
    }
  });

  function handleFile(file) {
    uploadedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImage.src = e.target.result;
      fileName.textContent = file.name;
      fileSize.textContent = formatFileSize(file.size);
      uploadZone.style.display = 'none';
      previewZone.classList.remove('hidden');
      nextStep1.disabled = false;
    };
    reader.readAsDataURL(file);
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  removeFile.addEventListener('click', () => {
    uploadedFile = null;
    fileInput.value = '';
    previewImage.src = '';
    uploadZone.style.display = 'flex';
    previewZone.classList.add('hidden');
    nextStep1.disabled = true;
  });

  return { getFile: () => uploadedFile };
}

// ============================================
// MULTI-STEP FORM
// ============================================
function initFormSteps() {
  const steps = document.querySelectorAll('.step');
  const stepLines = document.querySelectorAll('.step-line');
  const formSteps = document.querySelectorAll('.form-step');
  const nextStep1 = document.getElementById('next-step-1');
  const prevStep2 = document.getElementById('prev-step-2');
  const submitBtn = document.getElementById('submit-analysis');
  const patientForm = document.getElementById('patient-form');

  function goToStep(stepNum) {
    formSteps.forEach(s => s.classList.remove('active'));
    steps.forEach((s, i) => {
      s.classList.remove('active', 'completed');
      if (i + 1 < stepNum) s.classList.add('completed');
      if (i + 1 === stepNum) s.classList.add('active');
    });
    stepLines.forEach((line, i) => {
      if (i + 1 < stepNum) {
        line.classList.add('filled');
      } else {
        line.classList.remove('filled');
      }
    });
    document.getElementById(`step-${stepNum}`).classList.add('active');
  }

  nextStep1.addEventListener('click', () => goToStep(2));
  prevStep2.addEventListener('click', () => goToStep(1));

  patientForm.addEventListener('submit', (e) => {
    e.preventDefault();
    goToStep(3);
    runAnalysis();
  });
}

// ============================================
// ANALYSIS WORKFLOW
// ============================================
const API_BASE_URL = 'http://127.0.0.1:8000';

function buildPatientPayload() {
  const age = parseInt(document.getElementById('patient-age').value, 10) || 45;
  const bpSys = parseInt(document.getElementById('bp-systolic').value, 10) || 120;
  const bpDia = parseInt(document.getElementById('bp-diastolic').value, 10) || 80;
  const cholesterol = parseInt(document.getElementById('cholesterol').value, 10) || 200;
  const glucose = parseInt(document.getElementById('glucose').value, 10) || 100;
  const bmi = parseFloat(document.getElementById('patient-bmi').value) || 24.5;
  const smoking = document.querySelector('input[name="smoking"]:checked').value;
  const diabetes = document.querySelector('input[name="diabetes"]:checked').value;
  const familyCvd = document.querySelector('input[name="family-cvd"]:checked').value;
  const gender = document.getElementById('patient-gender').value;
  const currentSmoker = smoking === 'current' ? 1 : 0;
  const male = gender === 'male' ? 1 : 0;
  const diabetesFlag = diabetes === 'yes' ? 1 : 0;
  const pulsePressure = bpSys - bpDia;

  return {
    male,
    age,
    education: 1.0,
    currentSmoker,
    cigsPerDay: currentSmoker ? 10 : 0,
    BPMeds: 0,
    prevalentStroke: 0,
    prevalentHyp: familyCvd === 'yes' ? 1 : 0,
    diabetes: diabetesFlag,
    totChol: cholesterol,
    sysBP: bpSys,
    diaBP: bpDia,
    BMI: bmi,
    heartRate: 72,
    glucose,
    pulse_pressure: pulsePressure,
    smoker_intensity: currentSmoker,
    chol_age_ratio: age > 0 ? cholesterol / age : 0,
    hyp_diabetes: diabetesFlag + (familyCvd === 'yes' ? 1 : 0),
  };
}

async function runAnalysis() {
  const progressFill = document.getElementById('progress-fill');
  const analyzingStatus = document.getElementById('analyzing-status');
  const analyzingDetail = document.getElementById('analyzing-detail');
  const resultsSection = document.getElementById('results');
  const fileInput = document.getElementById('file-input');
  const uploadedFile = fileInput.files[0];

  if (!uploadedFile) {
    analyzingStatus.textContent = 'No image selected';
    analyzingDetail.textContent = 'Please upload a retinal fundus image before analyzing.';
    return;
  }

  const stages = [
    { progress: 15, status: 'Analyzing Retinal Image…', detail: 'Preprocessing fundus image…' },
    { progress: 30, status: 'Analyzing Retinal Image…', detail: 'Detecting blood vessel patterns…' },
    { progress: 50, status: 'Processing Biometrics…', detail: 'Evaluating patient risk factors…' },
    { progress: 70, status: 'Running Neural Network…', detail: 'Deep learning model inference…' },
    { progress: 85, status: 'Computing Risk Score…', detail: 'Aggregating multi-modal features…' },
    { progress: 100, status: 'Analysis Complete!', detail: 'Generating comprehensive report…' },
  ];

  let stageIndex = 0;

  function advanceStage() {
    if (stageIndex < stages.length) {
      const stage = stages[stageIndex];
      progressFill.style.width = stage.progress + '%';
      analyzingStatus.textContent = stage.status;
      analyzingDetail.textContent = stage.detail;
      stageIndex++;
      setTimeout(advanceStage, 700 + Math.random() * 400);
    }
  }

  advanceStage();

  try {
    const formData = new FormData();
    formData.append('image', uploadedFile);
    formData.append('patient_data', JSON.stringify(buildPatientPayload()));

    const response = await fetch(`${API_BASE_URL}/predict`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Prediction request failed');
    }

    const prediction = await response.json();

    setTimeout(() => {
      resultsSection.classList.remove('hidden');
      resultsSection.scrollIntoView({ behavior: 'smooth' });
      populateResults(prediction);
    }, 1000);
  } catch (error) {
    console.error(error);
    setTimeout(() => {
      resultsSection.classList.remove('hidden');
      resultsSection.scrollIntoView({ behavior: 'smooth' });
      populateResults(null, error.message);
    }, 1000);
  }
}

// ============================================
// POPULATE RESULTS
// ============================================
function populateResults(prediction, errorMessage) {
  const gaugeNumber = document.getElementById('gauge-number');
  const gaugeArc = document.getElementById('gauge-arc');
  const riskLevelEl = document.getElementById('risk-level');
  const riskDescEl = document.getElementById('risk-description');
  const totalArc = 251.2;

  const riskScore = prediction?.combined?.confidence != null ? Math.round(prediction.combined.confidence) : null;
  const targetDash = riskScore != null ? (riskScore / 100) * totalArc : 0;

  if (riskScore == null) {
    gaugeNumber.textContent = '-';
    gaugeArc.setAttribute('stroke-dasharray', `0 ${totalArc}`);
  }

  const startTime = performance.now();
  const duration = 2000;

  function animateGauge(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);

    if (riskScore != null) {
      const currentVal = Math.floor(eased * riskScore);
      gaugeNumber.textContent = currentVal;
      gaugeArc.setAttribute('stroke-dasharray', `${eased * targetDash} ${totalArc}`);
    }

    if (progress < 1 && riskScore != null) {
      requestAnimationFrame(animateGauge);
    }
  }

  if (riskScore != null) {
    requestAnimationFrame(animateGauge);
  }

  let level;
  let desc;

  if (errorMessage || !prediction?.combined) {
    level = '<span class="risk-badge moderate">No Results</span>';
    desc = errorMessage
      ? `The backend could not complete the prediction: ${errorMessage}`
      : 'No backend prediction is available. Please ensure the backend is running and try again.';
    riskLevelEl.innerHTML = level;
    riskDescEl.textContent = desc;
  } else if (prediction.combined.risk === 'High') {
    level = '<span class="risk-badge high">High Risk</span>';
    desc = 'The combined image and biometrics analysis indicates elevated cardiovascular risk. We strongly recommend consulting a cardiologist for further diagnostic testing.';
    riskLevelEl.innerHTML = level;
    riskDescEl.textContent = desc;
  } else if (prediction.combined.risk === 'Medium') {
    level = '<span class="risk-badge moderate">Moderate Risk</span>';
    desc = 'The analysis indicates moderate cardiovascular risk. A follow-up with a healthcare professional is recommended.';
    riskLevelEl.innerHTML = level;
    riskDescEl.textContent = desc;
  } else {
    level = '<span class="risk-badge low">Low Risk</span>';
    desc = 'Great news! The analysis indicates a low cardiovascular risk. Continue maintaining a healthy lifestyle with regular exercise and balanced nutrition.';
    riskLevelEl.innerHTML = level;
    riskDescEl.textContent = desc;
  }

  const vesselTortuosity = prediction?.image_model?.confidence ?? null;
  const avRatio = prediction?.tabular_model?.confidence ?? null;
  const opticDisc = prediction?.image_model?.probabilities?.High ?? null;
  const hemorrhage = prediction?.combined?.confidence ?? null;

  setTimeout(() => {
    document.getElementById('vessel-tortuosity').style.width = vesselTortuosity != null ? vesselTortuosity + '%' : '0%';
    document.getElementById('vessel-tortuosity-val').textContent = vesselTortuosity != null ? `${vesselTortuosity.toFixed(0)}%` : '-';
    document.getElementById('av-ratio').style.width = avRatio != null ? avRatio + '%' : '0%';
    document.getElementById('av-ratio-val').textContent = avRatio != null ? `${avRatio.toFixed(0)}%` : '-';
    document.getElementById('optic-disc').style.width = opticDisc != null ? opticDisc + '%' : '0%';
    document.getElementById('optic-disc-val').textContent = opticDisc != null ? `${opticDisc.toFixed(0)}%` : '-';
    document.getElementById('hemorrhage').style.width = hemorrhage != null ? hemorrhage + '%' : '0%';
    document.getElementById('hemorrhage-val').textContent = hemorrhage != null ? `${hemorrhage.toFixed(0)}%` : '-';
  }, 500);

  // Risk factors
  const age = parseInt(document.getElementById('patient-age').value, 10) || 45;
  const bpSys = parseInt(document.getElementById('bp-systolic').value, 10) || 120;
  const bpDia = parseInt(document.getElementById('bp-diastolic').value, 10) || 80;
  const cholesterol = parseInt(document.getElementById('cholesterol').value, 10) || 200;
  const glucose = parseInt(document.getElementById('glucose').value, 10) || 100;
  const smoking = document.querySelector('input[name="smoking"]:checked').value;
  const diabetes = document.querySelector('input[name="diabetes"]:checked').value;
  const familyCvd = document.querySelector('input[name="family-cvd"]:checked').value;

  const factorList = document.getElementById('factor-list');
  const factors = [
    { label: 'Age', value: `${age} years`, risk: age > 50 },
    { label: 'Blood Pressure', value: `${bpSys}/${bpDia} mmHg`, risk: bpSys > 130 || bpDia > 85 },
    { label: 'Cholesterol', value: cholesterol ? `${cholesterol} mg/dL` : 'N/A', risk: cholesterol > 200 },
    { label: 'Glucose', value: glucose ? `${glucose} mg/dL` : 'N/A', risk: glucose > 100 },
    { label: 'Smoking', value: smoking.charAt(0).toUpperCase() + smoking.slice(1), risk: smoking !== 'never' },
    { label: 'Diabetes', value: diabetes === 'yes' ? 'Yes' : 'No', risk: diabetes === 'yes' },
    { label: 'Family CVD', value: familyCvd === 'yes' ? 'Yes' : 'No', risk: familyCvd === 'yes' },
  ];

  factorList.innerHTML = factors.map(f => `
    <div class="factor-item">
      <span class="factor-label">${f.label}</span>
      <span class="factor-value ${f.risk ? 'risk-positive' : 'risk-negative'}">${f.value}</span>
    </div>
  `).join('');

  const recommendations = document.getElementById('recommendations');
  const recs = [
    { icon: '🫀', text: 'Schedule a comprehensive cardiovascular examination with a specialist.' },
    { icon: '🥗', text: 'Maintain a heart-healthy diet rich in vegetables, fruits, and whole grains.' },
    { icon: '🏃', text: 'Engage in at least 150 minutes of moderate aerobic activity per week.' },
    { icon: '🩺', text: 'Monitor blood pressure regularly and maintain it below 130/85 mmHg.' },
  ];

  if (riskScore != null && riskScore > 40 && prediction?.combined?.risk != null) {
    recs.push({ icon: '💊', text: 'Consider statin therapy if LDL cholesterol remains elevated after lifestyle changes.' });
    recs.push({ icon: '🚭', text: 'If you smoke, seek help to quit — this is the single most impactful change.' });
  }

  if (riskScore == null) {
    recs.length = 0;
    recs.push({ icon: '⚠️', text: 'No backend prediction available. Please ensure the backend is running and retry.' });
  }

  recommendations.innerHTML = recs.map(r => `
    <div class="rec-item">
      <span style="font-size: 18px; min-width: 20px;">${r.icon}</span>
      <span>${r.text}</span>
    </div>
  `).join('');
}

// ============================================
// RESULT ACTIONS
// ============================================
function initResultActions() {
  const downloadBtn = document.getElementById('download-report');
  const newScanBtn = document.getElementById('new-scan');

  downloadBtn.addEventListener('click', () => {
    // Create a simple text report
    const name = document.getElementById('patient-name').value || 'Patient';
    const score = document.getElementById('gauge-number').textContent;
    const report = `
╔══════════════════════════════════════════════════╗
║           RETINAVISION AI - CVD REPORT           ║
╠══════════════════════════════════════════════════╣

  Patient: ${name}
  Date: ${new Date().toLocaleDateString()}
  
  CVD Risk Score: ${score}%
  
  Age: ${document.getElementById('patient-age').value}
  Gender: ${document.getElementById('patient-gender').value}
  Blood Pressure: ${document.getElementById('bp-systolic').value}/${document.getElementById('bp-diastolic').value} mmHg
  Cholesterol: ${document.getElementById('cholesterol').value || 'N/A'} mg/dL
  Glucose: ${document.getElementById('glucose').value || 'N/A'} mg/dL
  
  ─────────────────────────────────────────────────
  
  DISCLAIMER: This report is generated by an AI system
  for screening purposes only. It is NOT a substitute
  for professional medical diagnosis or treatment.
  
  Please consult a qualified healthcare professional
  for proper medical evaluation.

╚══════════════════════════════════════════════════╝
    `.trim();

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `CVD_Report_${name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  });

  newScanBtn.addEventListener('click', () => {
    // Reset everything
    document.getElementById('results').classList.add('hidden');
    document.getElementById('progress-fill').style.width = '0%';
    document.getElementById('patient-form').reset();

    // Reset file upload
    const uploadZone = document.getElementById('upload-zone');
    const previewZone = document.getElementById('preview-zone');
    uploadZone.style.display = 'flex';
    previewZone.classList.add('hidden');
    document.getElementById('file-input').value = '';
    document.getElementById('next-step-1').disabled = true;

    // Reset steps
    const steps = document.querySelectorAll('.step');
    const stepLines = document.querySelectorAll('.step-line');
    const formSteps = document.querySelectorAll('.form-step');

    steps.forEach((s, i) => {
      s.classList.remove('active', 'completed');
      if (i === 0) s.classList.add('active');
    });
    stepLines.forEach(l => l.classList.remove('filled'));
    formSteps.forEach(s => s.classList.remove('active'));
    document.getElementById('step-1').classList.add('active');

    // Scroll to upload
    document.getElementById('upload').scrollIntoView({ behavior: 'smooth' });
  });
}

// ============================================
// STREAMLIT LAUNCHER
// ============================================
function initStreamlitLauncher() {
  const launchBtn = document.getElementById('open-streamlit-btn');

  if (launchBtn) {
    launchBtn.addEventListener('click', () => {
      window.open('http://localhost:8501', '_blank', 'noopener,noreferrer');
    });
  }
}

// ============================================
// INIT ALL
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  initThreeBackground();
  initLoader();
  initNavbar();
  initStatCounters();
  initScrollAnimations();
  initUpload();
  initFormSteps();
  initResultActions();
  initStreamlitLauncher();
});
