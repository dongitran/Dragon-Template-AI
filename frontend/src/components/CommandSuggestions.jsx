import { FileTextOutlined, RightOutlined } from '@ant-design/icons';
import './CommandSuggestions.css';

/**
 * CommandSuggestions - Display command suggestion buttons after AI responses
 * @param {Function} onGeneratePlan - Callback when "Generate Project Plan" is clicked
 */
function CommandSuggestions({ onGeneratePlan }) {
    return (
        <div className="command-suggestions">
            <div className="command-suggestions-label">Please select to generate</div>
            <div className="command-suggestions-buttons">
                <button
                    className="command-suggestion-btn"
                    onClick={onGeneratePlan}
                >
                    <FileTextOutlined className="command-suggestion-icon" />
                    <span className="command-suggestion-text">Generate Project Plan</span>
                    <RightOutlined className="command-suggestion-chevron" />
                </button>
            </div>
        </div>
    );
}

export default CommandSuggestions;
