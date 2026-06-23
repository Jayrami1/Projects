import { useState } from 'react';
import styles from './WorkFlow.module.css';

// Define the Status type to match your Prisma enum
type Status = 'TO_DO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';

interface Column {
  id: string;
  name: string;
  cStatus: Status;
}

interface WorkFlowProps {
  projectId: string;
  currentWorkflow: Record<string, string[]> | null;
  columns: Column[];
  onClose: () => void;
}

export default function WorkFlow({
  projectId,
  currentWorkflow,
  columns,
  onClose,
}: WorkFlowProps) {
  const [workflow, setWorkflow] = useState<Record<string, string[]>>(() => {
    // If DB already has custom rules, use them
    if (currentWorkflow && Object.keys(currentWorkflow).length > 0) {
      return currentWorkflow;
    }
    const defaultRules: Record<string, string[]> = {};
    const statusOrder = ['TO_DO', 'IN_PROGRESS', 'REVIEW', 'DONE']; // Status order

    columns.forEach((sourceCol) => {
      const sourceStatus = sourceCol.cStatus;
      const currentIndex = statusOrder.indexOf(sourceStatus);

      const allowedTargets = columns // Default allowed are +- 1 of sourceColumn
        .filter((targetCol) => {
          const targetStatus = targetCol.cStatus;
          const targetIndex = statusOrder.indexOf(targetStatus);
          return (
            targetCol.id !== sourceCol.id &&
            (targetStatus === sourceStatus ||
              targetIndex === currentIndex + 1 ||
              targetIndex === currentIndex - 1)
          );
        })
        .map((t) => t.id);

      defaultRules[sourceCol.id] = allowedTargets;
    });

    return defaultRules;
  });

  const handleToggle = (sourceId: string, targetId: string) => {
    // Checkable box sets workflow for checked ones
    setWorkflow((prev) => {
      const sourceTargets = prev[sourceId] || [];
      if (sourceTargets.includes(targetId)) {
        return {
          ...prev,
          [sourceId]: sourceTargets.filter((t) => t !== targetId),
        };
      } else {
        return { ...prev, [sourceId]: [...sourceTargets, targetId] };
      }
    });
  };

  const handleSave = async () => {
    // Save the workflow transistions
    try {
      const res = await fetch(`/api/projects/${projectId}/workflow`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow }),
      }); // Passes in json the  workflow as fetch
      if (res.ok) {
        alert('Column transitions saved successfully!');
        onClose();
      } else {
        const err = await res.json();
        alert('Failed: ' + err.error);
      }
    } catch (e) {
      console.error('Error saving workflow:', e);
    }
  };

  const handleReset = () => {
    // Reset sets the workflow transistions to default
    const defaultRules: Record<string, string[]> = {};
    const statusOrder = ['TO_DO', 'IN_PROGRESS', 'REVIEW', 'DONE'];

    columns.forEach((sourceCol) => {
      const sourceStatus = sourceCol.cStatus;
      const currentIndex = statusOrder.indexOf(sourceStatus);
      const allowedTargets = columns
        .filter((targetCol) => {
          const targetStatus = targetCol.cStatus;
          const targetIndex = statusOrder.indexOf(targetStatus);
          return (
            targetCol.id !== sourceCol.id &&
            (targetStatus === sourceStatus ||
              targetIndex === currentIndex + 1 ||
              targetIndex === currentIndex - 1)
          );
        })
        .map((t) => t.id);
      defaultRules[sourceCol.id] = allowedTargets;
    });

    setWorkflow(defaultRules);
  };
  return (
    // Custom checable matrix for workflow transistions of each
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h2>Customize Column Transitions</h2>
        <p>Define exactly which columns tasks can move between.</p>
        <div className={styles.matrix}>
          {columns.map((sourceCol) => (
            <div key={sourceCol.id} className={styles.row}>
              <strong>From {sourceCol.name}</strong> can move to:
              <div className={styles.checkboxGroup}>
                {columns
                  .filter((t) => t.id !== sourceCol.id)
                  .map((targetCol) => (
                    <label key={targetCol.id}>
                      <input
                        type="checkbox"
                        checked={(workflow[sourceCol.id] || []).includes(
                          targetCol.id
                        )}
                        onChange={() =>
                          handleToggle(sourceCol.id, targetCol.id)
                        }
                      />
                      {targetCol.name}
                    </label>
                  ))}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.actions}>
          <button className={styles.btnReset} onClick={handleReset}>
            Reset to Defaults
          </button>
          <button className={styles.btnCancel} onClick={onClose}>
            Cancel
          </button>
          <button className={styles.btnSave} onClick={handleSave}>
            Save Rules
          </button>
        </div>
      </div>
    </div>
  );
}
