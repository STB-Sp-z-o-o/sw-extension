// js/ui.js

function createModal(id, title, contentHtml) {
    // Remove existing modal first to prevent duplicates
    const existingModal = document.getElementById(id);
    if (existingModal) {
        existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = id;
    modal.style.position = 'fixed';
    modal.style.left = '0';
    modal.style.top = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modal.style.zIndex = '10000';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';

    const modalContent = document.createElement('div');
    modalContent.style.backgroundColor = 'white';
    modalContent.style.padding = '20px';
    modalContent.style.borderRadius = '5px';
    modalContent.style.width = '50%';
    modalContent.style.maxHeight = '80vh';
    modalContent.style.overflowY = 'auto';

    const modalHeader = document.createElement('div');
    modalHeader.style.display = 'flex';
    modalHeader.style.justifyContent = 'space-between';
    modalHeader.style.alignItems = 'center';
    modalHeader.innerHTML = `<h2>${title}</h2>`;

    const closeButton = document.createElement('button');
    closeButton.textContent = '\u00D7'; // Multiplication sign for 'X'
    closeButton.style.border = 'none';
    closeButton.style.background = 'transparent';
    closeButton.style.fontSize = '1.5rem';
    closeButton.style.cursor = 'pointer';
    closeButton.onclick = () => modal.style.display = 'none';

    modalHeader.appendChild(closeButton);
    modalContent.appendChild(modalHeader);
    modalContent.insertAdjacentHTML('beforeend', contentHtml);
    modal.appendChild(modalContent);

    // Close modal if clicking on the background
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });

    document.body.appendChild(modal);
    return modal;
}
