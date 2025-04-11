/**
 * Represents a visual theme for the application UI.
 * 
 * @interface Theme
 * @property {string} id - Unique identifier for the theme
 * @property {string} name - Display name of the theme
 * @property {object} colors - Collection of color settings for the theme
 * @property {string} colors.primaryColor - Main primary color
 * @property {string} colors.primaryLight - Lighter shade of the primary color
 * @property {string} colors.primaryDark - Darker shade of the primary color
 * @property {string} colors.secondaryColor - Main secondary/accent color
 * @property {string} colors.secondaryLight - Lighter shade of the secondary color
 * @property {string} colors.secondaryDark - Darker shade of the secondary color
 * @property {string} colors.backgroundColor - Background color for the application
 * @property {string} colors.textColor - Main text color
 * @property {string} colors.textLight - Lighter variant of the text color
 * @property {string} colors.borderColor - Color used for borders and dividers
 * @property {string} colors.canvasBackgroundColor - Background color for canvas
 * @property {string} colors.canvasDrawingColor - Color for drawing lines on canvas
 */
export interface Theme {
  id: string;
  name: string;
  colors: {
    primaryColor: string;
    primaryLight: string;
    primaryDark: string;
    secondaryColor: string;
    secondaryLight: string;
    secondaryDark: string;
    backgroundColor: string;
    textColor: string;
    textLight: string;
    borderColor: string;
    iconColor: string;
    iconHoverColor: string;
    iconActiveColor: string;
    iconDisabledColor: string;
    navBackgroundColor: string;
    canvasBackgroundColor: string;
    canvasDrawingColor: string;
  };
}
