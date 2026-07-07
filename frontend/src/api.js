const API_URL = 'http://127.0.0.1:8000';

export async function predictCVD(imageFile, patientData) {
  const formData = new FormData();
  formData.append('image', imageFile);
  formData.append('patient_data', JSON.stringify(patientData));

  try {
    const response = await fetch(`${API_URL}/predict`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Prediction error:', error);
    throw error;
  }
}

export async function checkHealth() {
  try {
    const response = await fetch(`${API_URL}/health`);
    return await response.json();
  } catch (error) {
    console.error('Health check failed:', error);
    return { status: 'error' };
  }
}
