let state = {
    vehicle: 'car', // Default
    issue: 'tyre'   // Default
};

function nextStep(stepNumber) {
    // Hide all steps
    document.querySelectorAll('.step-content').forEach(el => el.classList.add('hidden-step'));

    // Show current step
    const currentStep = document.getElementById(`step-${stepNumber}`);
    if (currentStep) {
        currentStep.classList.remove('hidden-step');
        currentStep.classList.add('animate-fade-in');
    }

    // Update progress bar
    document.querySelectorAll('.progress-step').forEach((el, index) => {
        if (index < stepNumber) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });

    // Special logic for final step
    if (stepNumber === 3) {
        simulateSearch();
    }
}

function selectOption(element, type, value) {
    // Remove selected from siblings
    element.parentElement.querySelectorAll('.selection-item').forEach(el => el.classList.remove('selected'));

    // Add to clicked
    element.classList.add('selected');

    // Store value
    state[type] = value;

    // Clear error if exists
    const err = document.getElementById(`${type}-error`);
    if (err) err.style.display = 'none';
}

function validateAndNext(nextStepNum) {
    if (nextStepNum === 3) {
        if (!state.issue) {
            document.getElementById('issue-error').style.display = 'block';
            return;
        }
    }
    nextStep(nextStepNum);
}

function simulateSearch() {
    const searchView = document.getElementById('searching-view');
    const foundView = document.getElementById('found-view');

    if (searchView && foundView) {
        searchView.classList.remove('hidden-step');
        foundView.classList.add('hidden-step');

        setTimeout(() => {
            searchView.classList.add('hidden-step');
            foundView.classList.remove('hidden-step');
        }, 3000); // 3s delay
    }
}
