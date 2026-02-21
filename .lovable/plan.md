

## Plan: Move Topics & Regions to a New Explore Page

### Overview
Remove the "Preferred Topics" and "Preferred Regions" sections from the Settings page and create a dedicated Explore page (`/explore`) with a polished, cloud-style UI for browsing and selecting topics and regions.

### Changes

#### 1. Clean up Settings page (`src/pages/Settings.tsx`)
- Remove the `allTopics` and `allRegions` arrays
- Remove `selectedTopics`/`selectedRegions` state and the `toggleItem` helper
- Remove the "Preferred Topics" and "Preferred Regions" `<Section>` blocks
- Keep only: Profile, Briefing Length, and Voice Style sections

#### 2. Create Explore page (`src/pages/Explore.tsx`)
- New page with the same sidebar layout pattern (uses `AppSidebar` with `activePage="explore"`)
- Two sections: **Topics** and **Regions**, each displayed as a grid of interactive cards
- Each card will have:
  - An icon or emoji representing the topic/region
  - The label and a short description
  - A selected/unselected toggle state with smooth animations (framer-motion)
  - Glass-panel styling consistent with the rest of the app
- State managed with `useState` for selections
- Cloud-inspired UI: soft gradient backgrounds on cards, subtle glow effects on selected items, floating/elevated card feel

#### 3. Update routing (`src/App.tsx`)
- Import the new `Explore` component
- Add route: `<Route path="/explore" element={<Explore />} />`

#### 4. Update sidebar navigation (`src/components/AppSidebar.tsx`)
- Change the Explore nav item path from `"/"` to `"/explore"`

